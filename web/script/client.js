class Client {
    static #ws = null
    static #ws_init_queue = []
    static #ws_suc_callbacks = {}
    static #ws_err_callbacks = {}
    static #network_error = false
    static #req_id = 1

    static pageStack = []
    static applicationName = ""
    static lastFocus = null
    static requestFullscreen = false

    static rpcCancel() {
        let jReq = JSON.stringify({
            'type': 'cancel'
        }, null, 2)

        Client.debugLog("CANCEL\r\n" + jReq)
        Client.#ws.send(jReq)
    }

    static wsError() {
        if (!Client.#network_error) {
            Client.#network_error = true;

            let obj = {}
            obj['message'] = 'Network error: try again later.'
            obj['trace'] = []
            Client.showError(obj)
        }
    }

    static wsMessage(e) {
        Client.debugLog("RECEIVE\r\n" + e.data)

        let msg = JSON.parse(e.data)

        if (msg["requestid"]) {
            let suc = Client.#ws_suc_callbacks[msg["requestid"]]
            if (suc) {
                delete Client.#ws_suc_callbacks[msg["requestid"]]
                if (msg['type'] == 'response')
                    suc(msg["value"])
            }

            let err = Client.#ws_err_callbacks[msg["requestid"]]
            if (err) {
                delete Client.#ws_err_callbacks[msg["requestid"]]
                if (msg['type'] == 'exception')
                    err()
            }
        }

        Client.dispatchChunk(msg)
    }

    static wsOpen() {
        for (let i = 0; i < Client.#ws_init_queue.length; i++)
            Client.#ws.send(Client.#ws_init_queue[i])

        Client.#ws_init_queue = []
    }

    static rpcPost(request, success, error) {
        if (Client.#ws == null) {
            let uri = (window.location.protocol.toLowerCase().indexOf("https") > -1) ? "wss://" : "ws://"
            uri += window.location.host + "/rpc"

            Client.#ws = new WebSocket(uri)
            Client.#ws.onerror = Client.wsError
            Client.#ws.onclose = Client.wsError
            Client.#ws.onopen = Client.wsOpen
            Client.#ws.onmessage = Client.wsMessage
        }

        Client.#req_id++
        request["requestid"] = Client.#req_id

        let jReq = JSON.stringify(request, null, 2)
        Client.debugLog("SEND\r\n" + jReq)

        if (success)
            Client.#ws_suc_callbacks[Client.#req_id] = success

        if (error)
            Client.#ws_err_callbacks[Client.#req_id] = error

        if (Client.#ws.readyState == 0)
            Client.#ws_init_queue.push(jReq)
        else
            Client.#ws.send(jReq)
    }

    static dispatchChunk(obj) {
        switch (obj['type']) {
            case 'exception':
                Client.showError(obj)
                break

            case 'clientmessageauthentication':
                Client.handleCookie(obj)
                break

            case 'send':
                switch (obj['action']) {
                    case 'ui':
                        Renderer.handleUI(obj)
                        break

                    case 'dataset':
                    case 'datarow':
                        ClientData.handleData(obj)
                        break

                    case 'page':
                        Renderer.page(obj)
                        break

                    case 'reload':
                        if (obj['goHomepage'])
                            location.href = location.href.split("?")[0]
                        else
                            location.reload()
                        break

                    case 'requestFullscreen':
                        Client.requestFullscreen = true
                        break

                    case 'assertFocus':
                        window.setInterval(Client.assertFocus, 1000)
                        break

                    case 'navigate':
                        window.open(obj['url'], '_blank');
                        break

                    case 'download':
                        Client.handleDownload(obj)
                        break

                    case 'focusControl':
                        let ctl = $('#' + obj['controlId'])
                        if (ctl.length > 0) {
                            Client.lastFocus = ctl
                            ctl.first().trigger('focus')
                        }
                        break

                }
        }
    }

    static assertFocus() {
        if (Client.lastFocus != null) {
            if (!Client.lastFocus.is(":visible"))
                return

            if (document.activeElement != Client.lastFocus[0])
                Client.lastFocus.first().trigger('focus')
        }
    }

    static handleCookie(obj) {
        if (obj["Clear"]) {
            document.cookie = "X-Authorization=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;"

        } else {
            let expires = "";
            if (obj["Expires"]) {
                let dt = new Date(obj["Expires"])
                expires = "; Expires=" + dt.toUTCString()
            }
            document.cookie = "X-Authorization=" + obj["Token"] + expires + "; path=/"

        }
    }

    static handleDownload(obj) {
        let data = 'data:' + obj['mimeType'] + ';base64,' + obj['b64content']

        fetch(data).then((response) => response.blob()).then((blob) => {
            let url = URL.createObjectURL(blob)
            let a = $(`<a>`)
            if (obj['fileName'])
                a.attr("download", obj['fileName'])
            else
                a.attr("target", '_blank')
            a.attr("href", url)
            a[0].click()
            URL.revokeObjectURL(url)
        })
    }

    static showError(obj) {
        if ((obj['code'] == 6) ||          // E_INVALID_SESSION
            (obj['code'] == 1) ||          // E_SYSTEM_IN_MAINTENANCE
            (obj['code'] == 5))            // E_SYSTEM_NOT_READY
            Client.#network_error = true

        let traceMsg = ''
        for (let t in obj['trace'])
            traceMsg += obj['trace'][t] + '<br/>'

        let mod = new PageModal()
        mod.id = Functions.uuidv4()
        mod.layout = {
            "caption": 'Error'
        }
        mod.onClose = () => { if (Client.#network_error) location.reload() }
        mod.show()

        let msg = new ControlDiv()
        msg.layout = {
            "content": obj['message']
        }
        msg.appendTo(mod)
        msg.show()

        let trace = new ControlDiv()
        trace.layout = {
            "style": 'code',
            "content": traceMsg
        }
        trace.appendTo(mod)
        trace.show()

        let ok = new ControlAction()
        ok.layout = {
            "caption": 'OK',
            "color": 'primary',
            "shortcut": 'Escape'
        }
        ok.appendTo(mod, mod.uiFooter)
        ok.onClick = () => mod.close()
        ok.show()
    }

    static initialize() {
        Client.rpcPost({
            'type': 'request',
            'classname': 'Brayns.Shaper.Systems.ClientManagement',
            'method': 'Start',
            'arguments': {
                'pathname': window.location.pathname,
                'search': window.location.search
            }
        })

        $(document).on('keydown', Client.handleShortcut)
        $(window).on('hashchange', Client.handleHashChange)

        setTimeout(Client.poll, 1000);
    }

    static poll() {
        Client.rpcPost({
            'type': 'request',
            'classname': 'Brayns.Shaper.Systems.ClientManagement',
            'method': 'Poll',
            'arguments': {}

        }, () => {
            setTimeout(Client.poll, 10000);

        })
    }

    static handleShortcut(evt) {
        let n = Client.pageStack.length
        if (n == 0) return

        let page = Client.pageStack[n - 1]

        let k = ""
        if (evt.ctrlKey) k += "Ctrl+"
        if (evt.altKey) k += "Alt+"
        if (evt.shiftKey) k += "Shift+"
        k += evt.key

        if (page.shortcutMask.includes(k)) return;

        let ctls = page.findItemsByProperty('shortcut', k)
        if (ctls.length > 0) {
            if (ctls[0].click) {
                // assert validation of current field
                if (Client.lastFocus != null)
                    Client.lastFocus.first().trigger('blur')

                ctls[0].click()
                evt.preventDefault()
                return false
            }
        }
        else
            page.shortcutMask.push(k)
    }

    static handleHashChange(evt) {
        var hash = "";
        if (window.location.hash)
            hash = window.location.hash.substring(1)
    }

    static setTitle(title) {
        if (Client.applicationName)
            document.title = title + ' | ' + Client.applicationName
        else
            document.title = title
    }

    static debugLog(line) {
        if (window.location.hostname == "localhost")
            console.log(line)
    }

    static sizeToSuffix(size) {
        if ((size == "ExtraSmall") || (size == "Small"))
            return "-sm";

        if ((size == "ExtraLarge") || (size == "Large"))
            return "-lg";

        return "";
    }

    static getPageById(pageid) {
        for (let i in Client.pageStack)
            if (Client.pageStack[i].id == pageid)
                return Client.pageStack[i]
        return null
    }

    static leaveFocus() {
        let dummyBtn = $(`<button>`)
        dummyBtn.appendTo('body')
        dummyBtn.hide()
        dummyBtn.focus()
        dummyBtn.remove()
    }
}