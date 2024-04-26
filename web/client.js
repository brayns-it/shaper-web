/*
 *  >>> CLIENT STATUS
 *
 */

let client_status = {
    'application_name': '',
    'pages': [],
    'modals': [],
    'last_focus': null
}

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
        .replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0,
                v = c == 'x' ? r : (r & 0x3 | 0x8)
            return v.toString(16)
        })
}

let _ws = null
let _ws_init_queue = []
let _ws_callbacks = {}
let _network_error = false
let _req_id = 1

/*
 *  >>> NETWORK
 *
 */

function rpc_cancel() {
    let jReq = JSON.stringify({
        'type': 'cancel'
    }, null, 2)

    debug_log("CANCEL\r\n" + jReq)
    _ws.send(jReq)
}

function rpc_post(request, callback) {
    if (_ws == null) {
        let uri = (window.location.protocol.toLowerCase().indexOf("https") > -1) ? "wss://" : "ws://"
        uri += window.location.host + "/rpc"

        let ws_error = function (e) {
            if (!_network_error) {
                _network_error = true;

                obj = {}
                obj['message'] = 'Network error: try again later.'
                obj['trace'] = []
                show_error(obj)
            }
        }

        _ws = new WebSocket(uri)
        _ws.onerror = ws_error
        _ws.onclose = ws_error
        _ws.onopen = function (e) {
            for (let i = 0; i < _ws_init_queue.length; i++)
                _ws.send(_ws_init_queue[i])

            _ws_init_queue = []
        }
        _ws.onmessage = function (e) {
            debug_log("RECEIVE\r\n" + e.data)

            let msg = JSON.parse(e.data)

            if (msg["requestid"]) {
                let cb = _ws_callbacks[msg["requestid"]]
                if (cb) {
                    delete _ws_callbacks[msg["requestid"]]
                    cb(msg["value"])
                }
            }

            dispatch_chunk(msg)
        }
    }

    _req_id++
    request["requestid"] = _req_id

    let jReq = JSON.stringify(request, null, 2)
    debug_log("SEND\r\n" + jReq)

    if (callback)
        _ws_callbacks[_req_id] = callback

    if (_ws.readyState == 0)
        _ws_init_queue.push(jReq)
    else
        _ws.send(jReq)
}

function dispatch_chunk(obj) {
    if (obj['type'] == 'exception') {
        if ((obj['code'] == 6) ||          // E_INVALID_SESSION
            (obj['code'] == 1) ||          // E_SYSTEM_IN_MAINTENANCE
            (obj['code'] == 5))            // E_SYSTEM_NOT_READY
            _network_error = true

        show_error(obj)
        return
    }

    if (obj['type'] == 'send') {
        if (obj['action'] == 'closepage') {

            close_page(obj['pageid'])
            return
        }

        if ((obj['action'] == 'dataset') || (obj['action'] == 'datarow')) {
            handle_data(obj)
            return
        }

        if (obj['action'] == 'notifications') {
            handle_notifications(obj)
            return
        }

        if (obj['action'] == 'page') {
            run_page(obj)
            return
        }

        if (obj['action'] == 'redrawControl') {
            redraw_control(obj)
            return
        }

        if (obj['action'] == 'property') {
            if (obj['target'] == 'page')
                handle_page_properties(obj)
            return
        }

        if (obj['action'] == 'reload') {
            if (obj['goHomepage'])
                location.href = location.href.split("?")[0]
            else
                location.reload()
            return
        }

        if (obj['action'] == 'navigate') {
            window.open(obj['url'], '_blank');
            return
        }

        if (obj['action'] == 'download') {
            handle_download(obj)
            return
        }

        if (obj['action'] == 'focusControl') {
            let ctl = $('[ctl-id="' + obj['controlId'] + '"]').first()
            ctl.trigger('focus')
            return
        }

        if (obj['messageType'] == "ClientMessageAuthentication") {
            handle_cookie(obj)
            return
        }

    }
}

function handle_cookie(obj) {
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

/*
 *  >>> PROPERTIES
 *
 */

function handle_page_properties(obj) {
    if (obj['property'] == 'caption') {
        set_title(obj['value'])
        $('.content-wrapper').find('.content-header').find('[title-id="' + obj['pageid'] + '"]').html(obj['value'])
    }
}

function send_selection(grid) {
    let sel = []
    grid.find('.table-row-selector').find('input').each(function (i, e) {
        if ($(e).prop('checked') && $(e).attr('data-index'))
            sel.push($(e).attr('data-index') * 1)
    })

    rpc_post({
        'type': 'request',
        'objectid': grid.attr('page-id'),
        'method': 'SelectRows',
        'arguments': {
            'rows': sel
        }
    })
}

function toggle_grid_select(grid, selected) {
    grid.find('.table-row-selector').find('input').each(function (i, e) {
        if ($(e).attr('data-index'))
            $(e).prop('checked', selected)
    })

    if (selected)
        grid.find('.table-row-selector').show()
    else
        grid.find('.table-row-selector').hide()
}

function toggle_row_select(row, selected) {
    let grp = recurse_parent(row, 'page-id')

    let inp = row.find('.table-row-selector').find('input')
    inp.prop('checked', selected)

    if (selected) {
        grp.find('.table-row-selector').show()

        $('#control-sidebar').ControlSidebar('show')

    } else {
        let hasOne = false
        grp.find('.table-row-selector').find('input').each(function (i, e) {
            if ($(e).prop('checked'))
                hasOne = true
        })

        if (!hasOne)
            grp.find('.table-row-selector').hide()

        $('#control-sidebar').ControlSidebar('collapse')
    }
}

/*
 *  >>> PAGE DATA
 *
 */

function get_schema_field(page, codename) {
    for (let n in page['schema'])
        if (page['schema'][n]['codename'] == codename)
            return page['schema'][n];
    return null;
}

function handle_data(obj) {
    let page = get_pagebyid(obj['pageid'])
    if (!page)
        return

    let dom = $('#' + obj['pageid'])
    let data_grid = []

    for (let j = 0; j < obj["data"].length; j++) {
        let row_grid = {}

        for (let i = 0; i < page['schema'].length; i++) {
            let codename = page['schema'][i]['codename']
            let fieldType = page['schema'][i]['fieldType']
            let hasFormat = page['schema'][i]['hasFormat']
            let value = obj["data"][j][i]
            let fValue = obj["fdata"][j][i]
            if (!hasFormat) fValue = value

            if (j == 0) {
                let ctl = dom.find('[bind-codename="' + codename + '"]')
                if (ctl.length > 0) {
                    let tag = ctl.prop("tagName").toUpperCase()

                    if (ctl.prop("is-select-ext")) {
                        ctl.prop('x-value', value)
                        if (ctl[0].selectize.getValue() != value) {
                            ctl[0].selectize.clearOptions(true)
                            ctl[0].selectize.addOption({ value: value, caption: fValue })
                            ctl[0].selectize.setValue(value, true)
                            ctl.prop('_opened', false)
                        }
                        if (value == '')
                            ctl.prop('_opened', false)

                    } else if ((tag == 'INPUT') && (fieldType == 'BOOLEAN')) {
                        ctl.prop('checked', value)
                        ctl.prop('x-value', value)

                    } else if (tag == 'SELECT') {
                        ctl.val(value)
                        ctl.prop('x-value', value)

                    } else if (tag == 'DIV') {
                        ctl.html(fValue)
                        ctl.prop('x-value', fValue)

                    } else {
                        ctl.val(fValue)
                        ctl.prop('x-value', fValue)
                    }
                }
            }

            row_grid[codename] = {
                'value': value,
                'fValue': fValue
            }
        }

        data_grid.push(row_grid)
    }

    dom.find('[is-grid="1"]').each(function (i, e) {
        let grid = $(e)
        if (grid.attr('page-id') == obj['pageid'])
            handle_data_grid(data_grid, grid, obj)
    })
}

function handle_data_grid(data_grid, grid, obj) {
    let cols = []
    grid.find('thead').find('tr').find('th').each(function (i, e) {
        if ($(e).prop('codeName'))
            cols.push({
                'codeName': $(e).prop('codeName'),
                'fieldType': $(e).prop('fieldType'),
                'isLink': $(e).prop('isLink'),
                'fieldId': $(e).prop('fieldId'),
                'index': i
            })
    })

    let tbody = grid.find("tbody")

    if (obj['selectedrow'] > -1) {
        let row = tbody.find('[data-index="' + (obj['selectedrow'] * 1) + '"]')

        for (let j = 0; j < cols.length; j++) {
            let td = row.find('td').eq(cols[j].index)
            let content = data_grid[0][cols[j].codeName]['fValue']

            if (cols[j].isLink)
                td.find('a').html(content)
            else
                td.html(content)
        }

        return
    }

    if (obj["action"] == 'dataset') {
        toggle_grid_select(grid, false)
        tbody.empty()

        if (data_grid.length == 0) {
            let nodata_row = $(`<tr><td></td></tr>`)
            let nodata = nodata_row.find('td')
            nodata.attr("colspan", cols.length)
            nodata.html(grid.prop('labelNodata'))
            nodata_row.appendTo(tbody)
        }

        for (let i = 0; i < data_grid.length; i++) {
            let row = $(`<tr>`)
            row.attr('data-index', i)

            let selTh = $(`<td class="table-row-selector"><input type="checkbox"></th>`)
            selTh.hide()
            selTh.css('padding-top', '6px')
            selTh.css('padding-bottom', '6px')
            row.append(selTh)

            let selInp = selTh.find('input')
            selInp.attr('data-index', i)
            selInp.on('change', function (e) {
                let grp = recurse_parent($(e.target), 'page-id')
                let row = recurse_parent($(e.target), 'data-index')
                toggle_row_select(row, $(e).prop('checked'))
                send_selection(grp)
            })

            for (let j = 0; j < cols.length; j++) {
                let col = $(`<td>`)

                let content = data_grid[i][cols[j].codeName]['fValue']

                if (cols[j].isLink) {
                    let a = $(`<a>`)
                    a.attr('href', '#')
                    a.prop('fieldId', cols[j].fieldId)
                    a.html(content)
                    col.append(a)

                    a.on('click', function (e) {
                        let grp = recurse_parent($(e.target), 'page-id')
                        let row = recurse_parent($(e.target), 'data-index')

                        toggle_grid_select(grp, false)

                        rpc_post({
                            'type': 'request',
                            'objectid': grp.attr('page-id'),
                            'method': 'ControlInvoke',
                            'arguments': {
                                'controlid': $(e.target).prop('fieldId'),
                                'method': 'Trigger',
                                'args': {
                                    'row': row.attr('data-index') * 1
                                }
                            }
                        })
                    })

                } else
                    col.html(content)

                if ((cols[j].fieldType == 'DECIMAL') || (cols[j].fieldType == 'INTEGER'))
                    col.css('text-align', 'right')
                col.css('padding-top', '6px')
                col.css('padding-bottom', '6px')
                col.appendTo(row)
            }
            row.appendTo(tbody)
        }

        toggle_grid_pagination(grid, obj['count'], obj['pageSize'])
    }
}

/*
 *  >>> PAGE RENDERER
 *
 */

function is_shortcut(evt) {
    if (evt.ctrlKey) return true
    if (evt.altKey) return true
    if ((evt.key >= "F1") && (evt.key <= "F12")) return true
    if (evt.key.startsWith("Arrow")) return true
    if (evt.key == "Enter") return true
    if (evt.key == "Escape") return true
    return false
}

function handle_shortcut(evt) {
    if (client_status['modals'].length > 0) {
        if (evt.key == 'Enter') {
            client_status['modals'][client_status['modals'].length - 1].modal('hide')
            evt.preventDefault()
            return false
        }
        return;
    }

    if (is_shortcut(evt)) {
        let k = ""
        if (evt.ctrlKey) k += "Ctrl+"
        if (evt.altKey) k += "Alt+"
        if (evt.shiftKey) k += "Shift+"
        k += evt.key

        let c = $('[ctl-shortcut="' + k + '"]').first()
        if (c.length > 0) {
            if (client_status['last_focus'])
                client_status['last_focus'].trigger('blur')
            action_trigger(c)
            evt.preventDefault()
            return false
        }
    }
}

function get_pageindexbyid(pageid) {
    for (let k = 0; k < client_status['pages'].length; k++) {
        if (client_status['pages'][k]['id'] == pageid)
            return k
    }
    return -1
}

function get_pagebyid(pageid) {
    for (let k = 0; k < client_status['pages'].length; k++) {
        if (client_status['pages'][k]['id'] == pageid)
            return client_status['pages'][k]
    }
    return null
}

function pop_page(pageid) {
    let i = get_pageindexbyid(pageid)
    if (i > -1) {
        client_status['pages'].splice(i, 1)
        let n = ''
        if (client_status['pages'].length > 0)
            n = client_status['pages'][client_status['pages'].length - 1]['caption']
        set_title(n)
    }
}

function call_close_page(pageid) {
    rpc_post({
        'type': 'request',
        'objectid': pageid,
        'method': 'QueryClose',
        'arguments': {
        }
    })
}

function close_page(pageid) {
    let p = $('#' + pageid)
    if (p.length > 0) {
        if (p.prop('is-modal')) {
            p.on('shown.bs.modal', function (e) {
                p.modal('hide')
            })
            p.modal('hide')

        } else if (p.prop('is-content')) {
            p.remove()

            // remove menu
            let mnu = $("#menu-left")
            mnu.children().each(function (i, e) {
                if ($(e).attr('page-id') == pageid)
                    $(e).remove()
            })

            // restore title
            let head = $('.content-wrapper').find('.content-header')
            head.find('.container-fluid').show()

            let title = head.find('#title')
            title.children().each(function (i, e) {
                if ($(e).attr('page-id') == pageid) {
                    if ($(e).prev().prop('is-separator'))
                        $(e).prev().remove()
                    if ($(e).prev().prop('is-link')) {
                        let st = $(`<span>`)
                        st.html($(e).prev().html())
                        st.attr('page-id', $(e).prev().attr('page-id'))
                        st.attr('title-id', $(e).prev().prop('title-id'))
                        $(e).prev().remove()
                        $(e).before(st)
                    }
                    if ($(e).prev().attr('page-id')) {
                        let ppid = $(e).prev().attr('page-id')
                        $('#' + ppid).show()
                        mnu.children().each(function (i, e) {
                            if ($(e).attr('page-id') == ppid)
                                $(e).show()
                        })
                    }
                    $(e).remove()
                }
                if ($(e).prop('page-ids')) {
                    let i = $(e).prop('page-ids').indexOf(pageid)
                    if (i > -1)
                        $(e).prop('page-ids').splice(i, 1)
                }


            })

            // remove detail area
            $('#detail-area').empty()
            $('#control-sidebar').ControlSidebar('collapse')
            $('#control-sidebar-li').remove()
        }
    }

    pop_page(pageid)
}

function redraw_control(obj) {
    let ctl = $('[ctl-id="' + obj['id'] + '"]').first()
    ctl.remove()

    let args = ctl.prop('render-args')
    let arg0 = (args.length > 0) ? args[0] : null
    let arg1 = (args.length > 1) ? args[1] : null
    let arg2 = (args.length > 2) ? args[2] : null
    let arg3 = (args.length > 3) ? args[3] : null

    window[ctl.prop('render-function')](obj, arg0, arg1, arg2, arg3)
}

function run_page(obj) {
    client_status['pages'].push(obj)

    if (obj['parentId']) {
        if (obj['parentType'] == "ContentArea")
            render_controls_content_subpage(obj)
        else if (obj['parentType'] == "DetailArea")
            render_controls_detail_subpage(obj)

        return
    }

    client_status['application_name'] = obj['applicationName']
    set_title(obj['caption'])

    if ($('body').prop('pageType') == '') {
        if (obj['pageType'] == "Normal")
            show_page()
        else if (obj['pageType'] == "Start")
            show_start()
        else if (obj['pageType'] == "Login")
            show_login()
    }

    $('#sideTitle').html(obj['applicationName'])

    if (obj['display'] == 'content') {
        render_controls_content(obj)

    } else if (obj['display'] == 'modal') {
        render_controls_modal(obj)

    }

    let pageRow = $('#' + obj['id'])
    pageRow.find('input').first().trigger('focus')

    let head = $('.content-wrapper').find('.content-header').find('.container-fluid')
    if (obj['showHeader'])
        head.show()
    else
        head.hide()

    $('body').css('height', '');
    $('body').Layout('init')
}

function render_controls_modal(page) {
    let div = $(`
    <div class="modal fade" data-backdrop="static">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h4 class="modal-title" id='title'></h4>
                    <button type="button" class="close" id="close">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
    `)

    if ((page['unitType'] == "Brayns.Shaper.Systems.Confirm") || (page['unitType'] == "Brayns.Shaper.Systems.Message") ||
        (page['unitType'] == "Brayns.Shaper.Systems.Progress"))
        div.find('.modal-dialog').addClass('modal-lg')
    else
        div.find('.modal-dialog').addClass('modal-xl')

    div.prop('unitType', page['unitType'])
    div.attr('id', page['id'])
    div.prop('is-modal', true)
    div.prop('modal-id', uuidv4())
    div.find('#title').html(page['caption'])
    div.appendTo('body')

    for (let c in page['controls']) {
        let ctl = page['controls'][c]

        if (ctl['controlType'] == 'ActionArea')
            render_actionarea_modal(ctl, div, page)
        else if (ctl['controlType'] == 'ContentArea')
            render_contentarea_modal(ctl, div, page)
    }

    let close = div.find('#close')
    close.attr('page-id', page['id'])
    close.on('click', function (e) {
        let a = recurse_parent($(e.target), 'page-id')
        call_close_page(a.attr('page-id'))
    })

    div.on('hidden.bs.modal', function (e) {
        modal_closing(e)
    })

    div.modal('show')
    client_status['modals'].push(div)
}

function render_controls_content(page) {
    // hide menu
    let mnu = $("#menu-left")
    mnu.children().each(function (i, e) {
        if ($(e).attr('page-id'))
            $(e).hide()
    })

    // hide content
    let wrap = $('.content-wrapper')
    let title = wrap.find('.content-header').find('#title')

    if (title.children().length > 0) {
        let st = title.children(':last-child')

        let a = $(`<a href="javascript:;"></a>`)
        a.html(st.html())
        a.prop('is-link', true)
        a.prop('page-ids', [])
        a.attr('page-id', st.attr('page-id'))
        a.attr('title-id', st.prop('title-id'))
        a.on('click', function (e) {
            let pids = $(e.target).prop('page-ids')
            for (let i = 0; i < pids.length; i++)
                call_close_page(pids[i])
        })
        a.appendTo(title)

        let span = $(`<span> &gt; </span>`)
        span.prop('is-separator', true)
        span.appendTo(title)

        st.remove()

        title.children().each(function (i, e) {
            if ($(e).prop('page-ids'))
                $(e).prop('page-ids').push(page['id'])
        })
    }

    let th = $(`<span></span>`)
    th.html(page['caption'])
    th.attr('page-id', page['id'])
    th.attr('title-id', page['id'])
    th.appendTo(title)

    let fluid = wrap.find('#container')

    fluid.children().each(function (i, e) {
        $(e).hide()
    })

    // recurse controls
    for (let c in page['controls']) {
        let ctl = page['controls'][c]

        if (ctl['controlType'] == 'AppCenter')
            render_appcenter(ctl, page)

        else if (ctl['controlType'] == 'ActionArea')
            render_actionarea_content(ctl, page)

        else if (ctl['controlType'] == 'DetailArea')
            render_detailarea_content(ctl, page)

        else if (ctl['controlType'] == 'ContentArea')
            render_contentarea_content(ctl, page)

        else if (ctl['controlType'] == 'Footer')
            render_footer(ctl, page)
    }
}

/*
 *  >>> DETAIL AREA
 *
 */

function render_detailarea_content(ctl, page) {
    let li = $(`
        <li class="nav-item" id="control-sidebar-li">
            <a class="nav-link" data-widget="control-sidebar" id="control-sidebar" data-controlsidebar-slide="true" href="javascript:;" role="button">
                <i class="fas fa-th-large"></i>
            </a>   
        </li>
    `)
    $('#menu-right').append(li)

    let parent = $('#detail-area')
    parent.empty()

    for (let c in ctl['controls']) {
        let ctl2 = ctl['controls'][c]

        if (ctl2['controlType'] == 'Subpage')
            render_subpage_parent(ctl2, parent, page)
    }
}

function render_controls_detail_subpage(page) {
    let parent = $('[ctl-id="' + page['parentId'] + '"]').first()
    parent.attr('id', page['id'])

    // search content area
    let cArea = null
    for (let c in page['controls']) {
        let ctl = page['controls'][c]

        if (ctl['controlType'] == 'ContentArea') {
            cArea = ctl
            break
        }
    }
    if (!cArea)
        return

    // supported controls
    for (let c in cArea['controls']) {
        let ctl = cArea['controls'][c]

        if (ctl['controlType'] == 'Grid')
            render_grid_detail(ctl, parent, page)
        else if (ctl['controlType'] == 'Group')
            render_group_parent(ctl, parent, page)
    }

    // actions after controls
    for (let c in page['controls']) {
        let ctl = page['controls'][c]

        if (ctl['controlType'] == 'ActionArea') {
            let head = parent.find('.card-header')
            render_actionarea_card(ctl, head, page)
        }
    }
}

function render_grid_detail(ctl, parent, page) {
    let grp = $(`
        <div class="card card-light">
            <div class="card-header">
                <h3 class="card-title"></h3>
                <div class="card-tools">
                    <button type="button" class="btn btn-tool" data-card-widget="collapse">
                        <i class="fas fa-minus"></i>
                    </button>
                </div>
            </div>
            <div class="card-body table-responsive p-0" style="overflow-x: hidden">
                <table class="table table-hover text-nowrap">
                    <thead>
                        <tr></tr>
                    </thead>
                    <tbody>
                    </tbody>
                </table>
            </div>
        </div>
    `)

    grp.attr('is-grid', '1')
    grp.attr('ctl-id', ctl['id'])
    grp.attr('page-id', page['id'])
    grp.prop('labelNodata', ctl['labelNodata'])
    grp.appendTo(parent)

    let head = grp.find("thead").find("tr")

    for (let c in ctl['controls']) {
        let ctl2 = ctl['controls'][c]

        if (ctl2['controlType'] == 'Field') {
            let th = $(`<th>`)

            if ((ctl2['fieldType'] == 'DECIMAL') || (ctl2['fieldType'] == 'INTEGER'))
                th.css('text-align', 'right')

            th.html(ctl2['caption'])

            th.prop('fieldId', ctl2['id'])
            th.prop('isLink', ctl2['isLink'])
            th.prop('codeName', ctl2['codename'])
            th.prop('fieldType', ctl2['fieldType'])
            th.css('padding-top', '6px')
            th.css('text-wrap', 'wrap')
            th.css('padding-bottom', '6px')
            head.append(th)
        }
    }
}

function render_field_detail(ctl, parent, page, ctlParent) {
    let schema = get_schema_field(page, ctl['codename'])

    let row = $(`<div>`)
    row.addClass("row")
    row.appendTo(parent)


    let label = $(`<div class="col-form-label font-weight-normal" style="padding-top: 0px" />`)
    label.addClass('col-sm')
    label.html(ctl['caption'] + ':')
    label.appendTo(row)

    ctl['readOnly'] = true;

    let field = $(`<div />`)
    field.addClass('col-sm')
    render_input_html(ctl, field, page, schema)
    field.appendTo(row)
}

/*
 *  >>> SUBPAGE
 *
 */

function render_controls_content_subpage(page) {
    let parent = $('[ctl-id="' + page['parentId'] + '"]').first()
    parent.attr('id', page['id'])

    // recurse controls
    for (let c in page['controls']) {
        let ctl = page['controls'][c]

        if (ctl['controlType'] == 'ContentArea')
            render_contentarea_controls(ctl, parent, page)
    }

    // actions after controls
    for (let c in page['controls']) {
        let ctl = page['controls'][c]

        if (ctl['controlType'] == 'ActionArea') {
            let head = parent.find('.card-header')
            render_actionarea_card(ctl, head, page)
        }
    }
}

/*
 *  >>> CONTENT
 *
 */

function render_contentarea_content(ctl, page) {
    let container = $('#container')

    let carea = $(`
        <div class="row">
            <div id="row-content">
            </div>
        </div>
    `)

    carea.prop('is-content', true)
    carea.attr('id', page['id'])
    carea.attr('ctl-id', ctl['id'])
    carea.prop('render-function', 'render_contentarea_content')
    carea.prop('render-args', [page])
    container.append(carea)

    let cnt = carea.find('#row-content')
    carea.find('#row-content').addClass('col-12')

    render_contentarea_controls(ctl, cnt, page)
}

function render_contentarea_controls(ctl, parent, page) {

    for (let c in ctl['controls']) {
        let ctl2 = ctl['controls'][c]

        if (ctl2['controlType'] == 'Group')
            render_group_parent(ctl2, parent, page)
        else if (ctl2['controlType'] == 'Subpage')
            render_subpage_parent(ctl2, parent, page)
        else if (ctl2['controlType'] == 'Grid')
            render_grid_parent(ctl2, parent, page)
        else if (ctl2['controlType'] == 'Html')
            render_html_parent(ctl2, parent, page)
    }

}

/*
 *  >>> APP CENTER AND RELATED
 *
 */

function render_appcenter(ctl, page) {
    $('#sidemenu').empty()
    $('body').addClass('sidebar-collapse')
    $('#menu-left').empty()

    for (let c in ctl['controls']) {
        let ctl2 = ctl['controls'][c]

        if (ctl2['controlType'] == 'Indicator')
            render_indicator(ctl2)

        else if (ctl2['controlType'] == 'NavigationPane')
            render_navigationpane(ctl2, page)

        else if (ctl2['controlType'] == 'Notifications')
            render_notifications(ctl2, page)

        else if (ctl2['controlType'] == 'Search')
            render_search(ctl2, page)

        else if (ctl2['controlType'] == 'UserCenter')
            render_usercenter(ctl2, page)
    }

    $('body').Layout('init')
    $('[data-widget="treeview"]').Treeview('init')
}

function render_footer(ctl) {
    let foot = $(`.main-footer`)
    foot.html(ctl['caption'])
    foot.show()
}

function render_indicator(ctl) {
    let capt = ctl['caption']
    if (capt == '')
        return

    let li = $(`
        <li class="nav-item" id="indicator">
            <span class="badge badge-info"></span>
        </li>
    `)
    li.css('padding-top', '4px')
    li.css('padding-left', '16px')
    li.css('padding-right', '16px')
    li.find('.badge').html(capt)
    li.css('cursor', 'pointer')
    li.on('click', function () {
        document.documentElement.requestFullscreen()
    })
    $('#menu-right').append(li)
}

function render_search(ctl, page) {
    let li = $(`
    <li class="nav-item">
        <a class="nav-link" data-widget="navbar-search" href="javascript:;" role="button">
            <i class="fas fa-search"></i>
        </a>
        <div class="navbar-search-block">
            <form class="form-inline">
                <div class="input-group input-group-sm">
                    <input class="form-control form-control-navbar" type="search" id='search' placeholder=""
                           aria-label="Search">
                    <div class="input-group-append">
                        <button class="btn btn-navbar" type="submit">
                            <i class="fas fa-search"></i>
                        </button>
                        <button class="btn btn-navbar" type="button" data-widget="navbar-search">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            </form>
        </div>
    </li>
    `)

    li.find('#search').attr('placeholder', ctl['caption'])
    $('#menu-right').append(li)
}

function render_notifications(ctl, page) {
    let li = $(`
        <li class="nav-item dropdown" id="ctlNotification">
            <a class="nav-link" data-toggle="dropdown" href="javascript:;">
                <i class="fas fa-bell"></i>
                <span class="badge badge-danger navbar-badge" id='badge'></span>
            </a>
            <div class="dropdown-menu dropdown-menu-lg dropdown-menu-right">
            </div>
        </li>
    `)
    li.prop('has-actions', false)
    li.attr('ctl-id', ctl['id'])
    li.attr('page-id', page['id'])
    $('#menu-right').append(li)

    for (let c in ctl['controls']) {
        let ctl2 = ctl['controls'][c]

        if (ctl2['controlType'] == 'Action')
            render_action_notification(ctl2, ctl, page)
    }
}

function handle_notifications(obj) {
    let li = $('#ctlNotification')
    li.find('#badge').html('')

    let todel = []
    let div = li.find('.dropdown-menu')
    div.children().each(function (i, e) {
        if ($(e).prop('is-notification'))
            todel.push($(e))
    })
    for (let i = 0; i < todel.length; i++)
        todel[i].remove()

    let count = 0;

    for (let i = 0; i < obj['items'].length; i++) {
        let msg = $(`
                    <a href="javascript:;" class="dropdown-item">
                        <div class="media">
                            <div class="media-body">
                                <h3 class="dropdown-item-title">
                                    <span id='title'></span>
                                    <span class="float-right text-sm text-muted"><i id='icon'></i></span>
                                </h3>
                                <p class="text-sm" id='description'></p>
                                <p class="text-sm text-muted" id='age'><i class="far fa-clock mr-1"></i><span id='ageValue'></span></p>
                            </div>
                        </div>
                    </a>
                `)
        msg.prop('is-notification', true)

        if (obj['items'][i]['title']) {
            msg.find('#title').html(obj['items'][i]['title'])
            msg.find('#icon').addClass(obj['items'][i]['icon'])
        } else
            msg.find('.dropdown-item-title').remove()

        msg.find('#description').html(obj['items'][i]['description'])

        if (obj['items'][i]['age'])
            msg.find('#ageValue').html(obj['items'][i]['age'])
        else
            msg.find('#age').remove()

        if (obj['items'][i]['notificationID']) {
            msg.prop('notificationID', obj['items'][i]['notificationID'])
            count++;

            msg.on('click', function (e) {
                let ctl = recurse_parent($(e.target), 'ctl-id')
                let msg = recurse_parent($(e.target), 'notificationID')
                rpc_post({
                    'type': 'request',
                    'objectid': ctl.attr('page-id'),
                    'method': 'ControlInvoke',
                    'arguments': {
                        'controlid': ctl.attr('ctl-id'),
                        'method': 'Trigger',
                        'args': {
                            'notificationID': msg.prop('notificationID')
                        }
                    }
                })
            })
        }

        div.prepend(msg)

        let dro = $(`<div class="dropdown-divider"></div>`)
        dro.prop('is-notification', true)
        div.prepend(dro)

        if (count > 0)
            li.find('#badge').html(count)
    }
}

function render_usercenter(ctl, page) {
    let li = $(`
        <li class="nav-item dropdown">
            <a class="nav-link" data-toggle="dropdown" href="javascript:;">
                <i class="fas fa-cog"></i>
            </a>
            <div class="dropdown-menu dropdown-menu-lg dropdown-menu-right">
                <span class="dropdown-item dropdown-header" id="title"></span>
            </div>
        </li>
    `)
    li.find('#title').html(ctl['caption'])
    li.prop('id', ctl['id'])
    $('#menu-right').append(li)

    for (let c in ctl['controls']) {
        let ctl2 = ctl['controls'][c]

        if (ctl2['controlType'] == 'Action')
            render_action_usercenter(ctl2, ctl, page)
    }
}

function render_navigationpane(ctl, page) {
    $('body').removeClass('sidebar-collapse')

    if (ctl['caption'] > '') {
        $('#userPanel').show()
        $('#infoName').html(ctl['caption'])
    } else {
        $('#userPanel').hide()
    }

    let li = $(`
        <li class="nav-item" id="pushmenu">
            <a class="nav-link" data-widget="pushmenu" href="javascript:;" role="button"><i class="fas fa-bars"></i></a>
        </li>
    `)
    $('#menu-left').append(li)

    for (let c in ctl['controls']) {
        let ctl2 = ctl['controls'][c]

        if (ctl2['controlType'] == 'Action')
            render_action_navigationpane(ctl2, page)
        else if (ctl2['controlType'] == 'ActionGroup')
            render_actiongroup_navigationpane(ctl2, page)
    }
}

/*
 *  >>> ACTIONS INSIDE USER CENTER
 *
 */

function render_action_usercenter(ctl, parent, page) {
    let menu = $('#' + parent['id']).find('.dropdown-menu')
    menu.append(`
        <div class="dropdown-divider"></div>
    `)

    let act = $(`
        <a href="javascript:;" class="dropdown-item">
            <i id="icon"></i><span id="title"></span>
        </a>
    `)
    if (ctl['icon'] > '') {
        act.find('#icon').addClass(ctl['icon'])
        act.find('#icon').addClass('mr-2')
    }
    act.find('#title').html(ctl['caption'])

    act.attr('ctl-id', ctl['id'])
    act.attr('page-id', page['id'])
    act.on('click', function (e) {
        let a = recurse_parent($(e.target), 'ctl-id')
        action_trigger(a)
    })
    menu.append(act)
}

/*
 *  >>> ACTIONS INSIDE NOTIFICATION
 *
 */

function render_action_notification(ctl, parent, page) {
    let li = $('#ctlNotification')
    let div = li.find('.dropdown-menu')

    let act = $(`
        <div class="dropdown-divider"></div>
        <a href="javascript:;" class="dropdown-item">
            <i id="icon"></i><span id="title"></span>
        </a>
    `)
    if (ctl['icon'] > '') {
        act.find('#icon').addClass(ctl['icon'])
        act.find('#icon').addClass('mr-2')
    }
    act.find('#title').html(ctl['caption'])

    act.attr('ctl-id', ctl['id'])
    act.attr('page-id', page['id'])
    act.on('click', function (e) {
        let a = recurse_parent($(e.target), 'ctl-id')
        action_trigger(a)
    })
    div.append(act)
}

/*
 *  >>> MODALS
 *
 */

function modal_closing(e) {
    let ediv = $(e.target)
    ediv.remove()

    for (let i = 0; i < client_status['modals'].length; i++)
        if (client_status['modals'][i].prop('modal-id') == ediv.prop('modal-id')) {
            client_status['modals'].splice(i, 1)
            break;
        }

    if (client_status['last_focus'])
        client_status['last_focus'].trigger('focus')
}

function render_contentarea_modal(ctl, parent, page) {
    let hdr = parent.find('.modal-header')
    let div = $(`<div class="modal-body"></div>`)
    div.attr('ctl-id', ctl['id'])
    div.prop('render-function', 'render_contentarea_modal')
    div.prop('render-args', [parent, page])
    hdr.after(div)

    render_contentarea_controls(ctl, div, page)
}

function render_actionarea_modal(ctl, parent, page) {
    let cnt = parent.find('.modal-content')
    let div = $(`<div class="modal-footer"></div>`)
    cnt.append(div)

    for (let c in ctl['controls']) {
        let ctl2 = ctl['controls'][c]

        if (ctl2['controlType'] == 'Action')
            render_button_parent(ctl2, div, page)
    }
}

/*
 *  >>> CONTROLS IN PARENT
 *
 */

function toggle_grid_pagination(ctl, count, pageSize) {
    let pages = Math.ceil(count / pageSize)

    if (pages <= 1) {
        ctl.find('#page-f').remove()
        ctl.find('#page-p').remove()
        ctl.find('#page-l').remove()

    } else {
        let sg = ctl.find('#search-grp')

        if (ctl.find('#page-l').length == 0) {
            let pl = $(`
                <div style="display: inline-block" id="page-l">
                    <ul class="pagination pagination-sm">
                        <li class="page-item"><a href="javascript:;" class="page-link" id="golast">»</a></li>
                    </ul>
                </div>
            `)

            let al = pl.find('#golast')
            al.attr('page-id', ctl.attr('page-id'))
            al.prop('page-size', pageSize)
            al.prop('page-no', pages)
            al.on('click', function (e) {
                rpc_post({
                    'type': 'request',
                    'objectid': $(e.target).attr('page-id'),
                    'method': 'GetData',
                    'arguments': {
                        'offset': ($(e.target).prop('page-no') - 1) * $(e.target).prop('page-size')
                    }
                }, function () {
                    let grid = recurse_parent($(e.target), 'ctl-id')
                    let sl = grid.find('#page-p').find('select')
                    sl.val($(e.target).prop('page-no'))
                })
            })
            sg.after(pl)
        }

        if (ctl.find('#page-p').length == 0) {
            let pp = $(`
                <div style="display: inline-block" id="page-p">
                    <select class="form-control form-control-sm" id="pagination">
                    </select>
                </div>
            `)

            let sl = pp.find('select')
            for (let i = 1; i <= pages; i++) {
                let opt = $('<option>' + i + '</option>')
                sl.append(opt)
            }
            sl.attr('page-id', ctl.attr('page-id'))
            sl.prop('page-size', pageSize)
            sl.on('change', function (e) {
                rpc_post({
                    'type': 'request',
                    'objectid': $(e.target).attr('page-id'),
                    'method': 'GetData',
                    'arguments': {
                        'offset': ($(e.target).val() - 1) * $(e.target).prop('page-size')
                    }
                })
            })

            sg.after(pp)
        }

        if (ctl.find('#page-f').length == 0) {
            let pf = $(`
                <div style="display: inline-block" id="page-f">
                    <ul class="pagination pagination-sm">
                        <li class="page-item"><a href="javascript:;" class="page-link" id="gofirst">«</a></li>
                    </ul>
                </div>
            `)

            let af = pf.find('#gofirst')
            af.attr('page-id', ctl.attr('page-id'))
            af.prop('page-size', pageSize)
            af.on('click', function (e) {
                rpc_post({
                    'type': 'request',
                    'objectid': $(e.target).attr('page-id'),
                    'method': 'GetData',
                    'arguments': {
                        'offset': 0
                    }
                }, function () {
                    let grid = recurse_parent($(e.target), 'ctl-id')
                    let sl = grid.find('#page-p').find('select')
                    sl.val(1)
                })
            })
            sg.after(pf)
        }
    }
}

function render_grid_parent(ctl, parent, page) {
    let grp = $(`
        <div class="card card-light">
            <div class="card-header">
                <h3 class="card-title"></h3>
                <div class="card-tools">
                    <div style="display: inline-block" id="search-grp">
                        <div class="input-group input-group-sm">
                            <input type="text" class="form-control float-right" id="search">
                            <div class="input-group-append">
                                <button type="submit" class="btn btn-default" id="searchButton">
                                    <i class="fas fa-search"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                    <button type="button" class="btn btn-tool" data-card-widget="collapse">
                        <i class="fas fa-minus"></i>
                    </button>
                </div>
            </div>
            <div class="card-body table-responsive p-0">
                <table class="table table-hover text-nowrap">
                    <thead>
                        <tr></tr>
                    </thead>
                    <tbody>
                    </tbody>
                </table>
            </div>
        </div>
    `)

    grp.attr('is-grid', '1')
    grp.attr('ctl-id', ctl['id'])
    grp.attr('page-id', page['id'])
    grp.prop('labelNodata', ctl['labelNodata'])
    grp.appendTo(parent)

    let searchBox = grp.find('#search')
    let btns = grp.find('#searchButton')

    searchBox.attr('placeholder', ctl['label_search'])
    searchBox.on('keydown', function (evt) {
        if ((evt.key == 'Enter') || (evt.key == 'NumpadEnter')) {
            let grp = recurse_parent($(evt.target), 'page-id')
            let btns = grp.find('#searchButton')
            btns.trigger('click')
            evt.preventDefault()
            return false
        }
    })

    btns.on('click', function (e) {
        let grp = recurse_parent($(e.target), 'page-id')

        rpc_post({
            'type': 'request',
            'objectid': grp.attr('page-id'),
            'method': 'Search',
            'arguments': {
                'text': grp.find('#search').val()
            }
        })
    })

    let head = grp.find("thead").find("tr")

    let selTh = $(`<th class="table-row-selector"><input type="checkbox"></th>`)
    selTh.css('padding-top', '6px')
    selTh.css('padding-bottom', '6px')
    selTh.hide()
    head.append(selTh)
    selTh.find('input').on('change', function (e) {
        let grp = recurse_parent($(e.target), 'page-id')
        toggle_grid_select(grp, $(e.target).prop('checked'))
        send_selection(grp)
    })

    for (let c in ctl['controls']) {
        let ctl2 = ctl['controls'][c]

        if (ctl2['controlType'] == 'Field') {
            let th = $(`<th>`)

            if ((ctl2['fieldType'] == 'DECIMAL') || (ctl2['fieldType'] == 'INTEGER'))
                th.css('text-align', 'right')

            let sort = $(`<a href='javascript:;'>`)
            sort.html(ctl2['caption'])
            sort.appendTo(th)
            sort.on('click', function (e) {
                let grp = recurse_parent($(e.target), 'page-id')

                let th = $(e.target).closest('th')
                let i = th.find('i')
                let asc = true
                let cn = ''

                if (i.hasClass('fa-chevron-up')) {
                    i.removeClass('fa-chevron-up')
                    i.addClass('fa-chevron-down')
                    cn = th.prop('codeName')
                    asc = false

                } else if (i.hasClass('fa-chevron-down')) {
                    i.removeClass('fa-chevron-down')
                    i.hide()

                } else {
                    let thead = $(e.target).closest('thead')
                    thead.find('i').removeClass('fa-chevron-down')
                    thead.find('i').removeClass('fa-chevron-up')
                    thead.find('i').hide()

                    i.addClass('fa-chevron-up')
                    i.show()
                    cn = th.prop('codeName')
                }

                rpc_post({
                    'type': 'request',
                    'objectid': grp.attr('page-id'),
                    'method': 'Sort',
                    'arguments': {
                        'sortBy': cn,
                        'ascending': asc
                    }
                })
            })

            let i = $(`<i class="fas"></i>`)
            i.css("padding-left", "5px")
            i.css("font-size", ".75em")
            i.appendTo(th)
            i.hide()

            th.prop('fieldId', ctl2['id'])
            th.prop('isLink', ctl2['isLink'])
            th.prop('codeName', ctl2['codename'])
            th.prop('fieldType', ctl2['fieldType'])
            th.css('padding-top', '6px')
            th.css('padding-bottom', '6px')
            head.append(th)
        }
    }

    let tbody = grp.find("tbody")

    tbody.on('click', function (e) {
        if ($(e.target).prop('tagName') == "INPUT") // switch to change event
            return

        if ($(e.target).prop('tagName') == "A") // open record
            return

        let grp = recurse_parent($(e.target), 'ctl-id')
        let row = recurse_parent($(e.target), 'data-index')
        if (!row) return

        let inp = row.find('.table-row-selector').find('input')
        let c = !inp.prop('checked')
        toggle_grid_select(grp, false)
        toggle_row_select(row, c)
        send_selection(grp)
    })
}

function render_subpage_parent(ctl, parent, page) {
    let grp = $(`<div>`)
    grp.attr('ctl-id', ctl['id'])
    grp.prop('is-subpage', 1)
    grp.appendTo(parent)
}

function render_group_parent(ctl, parent, page) {
    let grp = $(`
        <div class="card">
            <div class="card-header">
                <h3 class="card-title"></h3>
            </div>
            <div class="card-body">
            </div>
        </div>
    `)
    grp.attr('ctl-id', ctl['id'])
    grp.prop('render-args', [parent, page])
    grp.prop('render-function', 'render_group_parent')

    if (ctl['primary'])
        grp.addClass('card-primary')
    else
        grp.addClass('card-light')

    if (ctl['collapsible']) {
        let tools = $(`
            <div class="card-tools">
                <button type="button" class="btn btn-tool" data-card-widget="collapse">
                    <i class="fas fa-minus"></i>
                </button>
            </div>
        `)
        grp.find('.card-header').append(tools)
    }

    if (page['parentType'] == "DetailArea")
        grp.find(".card-body").css('padding', '8px')

    grp.appendTo(parent)
    grp.find('.card-title').html(ctl['caption'])
    grp.find('.card-title').addClass('text' + size_to_suffix(ctl['fontSize']))
    let body = grp.find('.card-body')

    let actions = []

    for (let c in ctl['controls']) {
        let ctl2 = ctl['controls'][c]

        if (ctl2['controlType'] == 'Html')
            render_html_parent(ctl2, body, page)
        else if (ctl2['controlType'] == 'Field') {
            if (page['parentType'] == "DetailArea")
                render_field_detail(ctl2, body, page, ctl)
            else
                render_field_parent(ctl2, body, page, ctl)
        }
        else if (ctl2['controlType'] == 'ActionGroup')
            render_actiongroup_parent(ctl2, body, page)
        else if (ctl2['controlType'] == 'Action')
            actions.unshift(ctl2)
    }

    if (actions.length > 0) {
        let foot = $(`<div class="card-footer">`)
        foot.appendTo(grp)

        for (let c in actions)
            render_button_parent(actions[c], foot, page)
    }
}

function render_checkbox(ctl, parent, page, schema) {
    let grp = $(`<div class="form-check" style='height: 30px'>`)

    let inp = $(`<input type="checkbox" class="form-check-input">`)
    inp.appendTo(grp)
    inp.attr('bind-codename', ctl['codename'])
    inp.prop('ctl-type', ctl['controlType'])
    inp.attr('ctl-id', ctl['id'])
    inp.attr('page-id', page['id'])
    inp.attr('id', ctl['id'])
    inp.on('focus', function (e) {
        client_status['last_focus'] = $(e.target)
    })
    inp.on('change', function (e) {
        if ($(e.target).prop('x-value') === $(e.target).prop('checked'))
            return

        rpc_post({
            'type': 'request',
            'objectid': $(e.target).attr('page-id'),
            'method': 'ControlInvoke',
            'arguments': {
                'controlid': $(e.target).attr('ctl-id'),
                'method': 'Validate',
                'args': {
                    'value': $(e.target).prop('checked'),
                    'parseValue': false
                }
            }
        }, function (r) {
            if (!r)
                $(e.target).prop('checked', $(e.target).prop('x-value'))
        })
    })

    let lab = $(`<label class="form-check-label">`)
    lab.attr('for', ctl['id'])
    lab.html(ctl['caption'])
    lab.appendTo(grp)

    grp.appendTo(parent)
}

function render_select(ctl, parent, page, schema) {
    if (ctl['readOnly']) {
        render_input(ctl, parent, page, schema)
        return
    }

    let sel = $(`<select class="form-control custom-select-sm">`)
    sel.css('font-size', '.875rem')

    for (let i in schema['options']) {
        let opt = $(`<option>`)
        opt.attr('value', schema['options'][i]['value'])
        opt.html(schema['options'][i]['caption'])
        opt.appendTo(sel)
    }

    sel.attr('bind-codename', ctl['codename'])
    sel.prop('ctl-type', ctl['controlType'])
    sel.attr('ctl-id', ctl['id'])
    sel.attr('page-id', page['id'])
    sel.attr('id', ctl['id'])
    sel.on('focus', function (e) {
        client_status['last_focus'] = $(e.target)
    })
    sel.on('change', function (e) {
        if ($(e.target).prop('x-value') === $(e.target).val())
            return

        rpc_post({
            'type': 'request',
            'objectid': $(e.target).attr('page-id'),
            'method': 'ControlInvoke',
            'arguments': {
                'controlid': $(e.target).attr('ctl-id'),
                'method': 'Validate',
                'args': {
                    'value': $(e.target).val(),
                    'parseValue': true
                }
            }
        }, function (r) {
            if (!r)
                $(e.target).val($(e.target).prop('x-value'))
        })
    })

    sel.appendTo(parent)
}

function render_select_ext(ctl, parent, page, schema) {
    if (ctl['readOnly']) {
        render_input(ctl, parent, page, schema)
        return
    }

    function do_search(query, callback) {
        rpc_post({
            'type': 'request',
            'objectid': sel.attr('page-id'),
            'method': 'ControlInvoke',
            'arguments': {
                'controlid': sel.attr('ctl-id'),
                'method': 'GetValues',
                'args': {
                    'text': query
                }
            }
        }, function (r) {
            let data = []
            data.push({
                query: query,
                value: " ",
                caption: " "
            })

            if (r)
                for (let i = 0; i < r.length; i++) {
                    let item = {}

                    item['query'] = query
                    item['value'] = r[i]["value"]
                    if (r[i]["hasFormat"])
                        item['caption'] = r[i]["fvalue"]
                    else
                        item['caption'] = r[i]["value"]
                    item['display'] = r[i]["display"]

                    data.push(item)
                }

            callback(data)
        })
    }

    function do_validate(sel, value) {
        if (sel.prop('x-value') === value)
            return

        rpc_post({
            'type': 'request',
            'objectid': sel.attr('page-id'),
            'method': 'ControlInvoke',
            'arguments': {
                'controlid': sel.attr('ctl-id'),
                'method': 'Validate',
                'args': {
                    'value': value,
                    'parseValue': false
                }
            }
        }, function (r) {
            if (!r) {
                sel[0].selectize.setTextboxValue('')
                sel.prop('_opened', false)
            }
        })
    }

    function load_data(sel, data) {
        let val = sel[0].selectize.getValue()

        sel[0].selectize.clear(true)
        sel[0].selectize.clearOptions(true)
        sel[0].selectize.addOption(data)
        sel[0].selectize.setValue(val, true)
        sel[0].selectize.refreshOptions(true)
        sel.prop('_opened', true)
    }

    let sel = $(`<select class="form-control form-control-sm">`)
    sel.appendTo(parent)
    sel.selectize({
        valueField: "value",
        labelField: "caption",
        searchField: "query",
        selectOnTab: true,
        maxItems: 1,
        create: false,
        render: {
            item: function (i, e) {
                let sel = $(`<div>`)
                sel.html(i.caption)
                return sel.prop('outerHTML')
            },
            option: function (i, e) {
                let row = $(`<div class='row'>`)
                row.css('padding', '4px')
                if (i["display"]) {
                    for (let j = 0; j < i["display"].length; j++) {
                        let col = $(`<div class='col'>`)
                        col.html(i["display"][j])
                        col.appendTo(row)
                    }
                } else {
                    let col = $(`<div class='col'>`)
                    col.html("&nbsp;")
                    col.appendTo(row)
                }
                return row.prop('outerHTML')
            }
        },
        onDropdownOpen: function () {
            if (!sel.prop('_opened')) {
                this.close()
                let val = sel[0].selectize.getValue()
                do_search(val, function (data) { load_data(sel, data) })
            }
        },
        load: function (query, callback) {
            sel[0].selectize.clearOptions()
            do_search(query, callback)
        },
        onChange: function (value) {
            do_validate(sel, value)
            if (value == '')
                do_search("", function (data) { load_data(sel, data) })
        }
    })

    sel[0].selectize["$control_input"].on('change', function (e) {
        let val = sel[0].selectize.getTextboxValue()
        if (sel[0].selectize.isOpen && (val == ''))
            do_search("", function (data) { load_data(sel, data) })
        else if (!sel[0].selectize.isOpen)
            do_validate(sel, val)
    })

    sel.prop('is-select-ext', true)
    sel.attr('bind-codename', ctl['codename'])
    sel.prop('ctl-type', ctl['controlType'])
    sel.attr('ctl-id', ctl['id'])
    sel.attr('page-id', page['id'])
    sel.attr('id', ctl['id'])
    sel.on('focus', function (e) {
        client_status['last_focus'] = $(e.target)
    })
}

function render_input_html(ctl, parent, page, schema) {
    let inp = null

    if (ctl['readOnly']) {
        inp = $(`<div>`)
        inp.addClass('text' + size_to_suffix(ctl["fontSize"]))
    } else {
        // TODO
    }

    inp.attr('bind-codename', ctl['codename'])
    inp.prop('ctl-type', ctl['controlType'])
    inp.attr('ctl-id', ctl['id'])
    inp.attr('id', ctl['id'])
    inp.attr('page-id', page['id'])

    inp.appendTo(parent)
}

function render_input(ctl, parent, page, schema) {
    let inp = $(`<input class="form-control" role="presentation">`)
    inp.addClass("form-control" + size_to_suffix(ctl["fontSize"]))

    if (page['pageType'] != "Login")
        inp.attr('autocomplete', 'new-password')

    if (ctl['inputType'] == 'Password')
        inp.attr('type', 'password')

    if (ctl['readOnly'])
        inp.attr('readonly', true)

    inp.attr('bind-codename', ctl['codename'])
    inp.prop('ctl-type', ctl['controlType'])
    inp.attr('ctl-id', ctl['id'])
    inp.attr('id', ctl['id'])
    inp.attr('page-id', page['id'])
    inp.on('focus', function (e) {
        client_status['last_focus'] = $(e.target)
    })
    inp.on('change', function (e) {
        if ($(e.target).prop('x-value') === $(e.target).val())
            return

        rpc_post({
            'type': 'request',
            'objectid': $(e.target).attr('page-id'),
            'method': 'ControlInvoke',
            'arguments': {
                'controlid': $(e.target).attr('ctl-id'),
                'method': 'Validate',
                'args': {
                    'value': $(e.target).val(),
                    'parseValue': true
                }
            }
        }, function (r) {
            if (!r)
                $(e.target).val($(e.target).prop('x-value'))
        })
    })

    if (ctl['placeholder'])
        inp.attr("placeholder", ctl["caption"])

    let group = null
    if (schema["fieldType"] == "DATE") {
        group = $(`<div class="input-group date" data-target-input="nearest">`)
        group.attr('id', ctl['id'] + '-group')
        inp.addClass("datetimepicker-input")
        inp.attr("data-target", '#' + ctl['id'] + '-group')
        inp.appendTo(group)
        group.appendTo(parent)

        let tgl = $(`
            <div class="input-group-append" data-toggle="datetimepicker">
                <div class="input-group-text"><i class="fas fa-calendar-days"></i></div>
            </div>
        `)
        tgl.attr("data-target", '#' + ctl['id'] + '-group')
        tgl.appendTo(group)

        group.datetimepicker({
            locale: page['locale'],
            format: 'L'
        })
    }

    if (!group)
        inp.appendTo(parent)
}

function render_field_parent(ctl, parent, page, ctlParent) {
    let schema = get_schema_field(page, ctl['codename'])

    let newRow = true

    let row = parent.children(':last-child')
    if (row.length > 0) {
        if ((ctlParent['labelStyle'] == 'Horizontal') && (ctlParent['fieldPerRow'] == 'Two'))
            if (row.prop('ctl-count') == 1)
                newRow = false

        if (newRow)
            row.css('margin-bottom', '6px')
    }

    if (newRow) {
        row = $(`<div>`)
        row.addClass("row")
        row.appendTo(parent)
        row.prop('ctl-count', 1)
    } else {
        row.prop('ctl-count', 2)
    }

    let grp = $('<div class="form-group">')
    grp.css('margin-bottom', '0px')

    if (ctlParent['labelStyle'] == 'Horizontal')
        grp.addClass("row")
    if (ctlParent['fieldPerRow'] == 'One')
        grp.addClass("col-sm-12")
    else
        grp.addClass("col-sm-6")
    grp.appendTo(row)

    let hasLabel = true
    if (schema["fieldType"] == "BOOLEAN")
        hasLabel = false
    if (!ctl['showCaption'])
        hasLabel = false
    if (ctlParent['labelStyle'] == "Placeholder")
        hasLabel = false

    if (hasLabel) {
        let label = $(`<label class="col-form-label font-weight-normal" style="padding-top: 0px"></label>`)
        label.attr('for', ctl['id'])
        if (ctlParent['labelStyle'] == 'Horizontal')
            label.addClass('col-4')
        else
            label.addClass('col-12')
        label.addClass('text' + size_to_suffix(ctl["fontSize"]))
        if (ctl['caption'])
            label.html(ctl['caption'] + ':')
        label.appendTo(grp)
    }

    let field = $(`<div />`)
    if ((ctlParent['labelStyle'] == 'Horizontal') && hasLabel)
        field.addClass('col-8')
    else
        field.addClass('col-12')

    if (schema["hasRelations"])
        render_select_ext(ctl, field, page, schema)
    else
        if (schema["fieldType"] == "OPTION")
            render_select(ctl, field, page, schema)
        else if (schema["fieldType"] == "BOOLEAN")
            render_checkbox(ctl, field, page, schema)
        else if (ctl['inputType'] == "Html")
            render_input_html(ctl, field, page, schema)
        else
            render_input(ctl, field, page, schema)

    field.appendTo(grp)
}

function render_html_parent(ctl, parent, page) {
    let div = $(`<div></div>`)
    div.html(ctl['content'])
    parent.append(div)
}

function render_button_parent(ctl, parent, page) {
    let bnt = $(`
        <div class="btn-group">
            <button type="button" class="btn btn-default"></button>
        </div>
    `)
    bnt.find('button').html(ctl['caption'])
    bnt.attr('ctl-id', ctl['id'])
    bnt.attr('ctl-shortcut', ctl['shortcut'])
    bnt.attr('page-id', page['id'])

    if (parent.hasClass('card-footer')) {
        bnt.addClass('float-right')

        let space = $(`<span>`)
        space.html('&nbsp;')
        space.addClass('float-right')
        space.appendTo(parent)
    }

    parent.append(bnt)

    if (ctl['isCancelation'])
        bnt.on('click', function (e) {
            rpc_cancel()
        })
    else
        bnt.on('click', function (e) {
            let a = recurse_parent($(e.target), 'ctl-id')
            action_trigger(a)
        })

    for (let c in ctl['controls']) {
        let ctl2 = ctl['controls'][c]

        if (ctl2['controlType'] == 'Action')
            render_button_button(ctl2, bnt, page)
    }
}

function render_button_button(ctl, parent, page) {
    let btnpar = parent.children('button')
    btnpar.addClass('dropdown-toggle')
    btnpar.attr('data-toggle', 'dropdown')

    parent.off('click')

    let div = parent.children('.dropdown-menu')
    if (div.length == 0) {
        div = $(`<div class="dropdown-menu"></div>`)
        parent.append(div)
    }

    let a = $(`<a class="dropdown-item" href="javascript:;"></a>`)
    a.html(ctl['caption'])
    a.attr('ctl-id', ctl['id'])
    a.attr('page-id', page['id'])
    a.appendTo(div)

    a.on('click', function (e) {
        let a = recurse_parent($(e.target), 'ctl-id')
        action_trigger(a)
    })
}

function render_actiongroup_parent(ctl, parent, page) {
    let row = $(`<div>`)
    row.addClass("row")
    row.appendTo(parent)

    for (let c in ctl['controls']) {
        let ctl2 = ctl['controls'][c]

        if (ctl2['controlType'] == 'Action')
            render_action_actiongroup(ctl2, row, page)
    }
}

function render_action_actiongroup(ctl, parent, page) {
    let a = $(`<a>`)
    a.addClass("btn")
    a.addClass("btn-app")
    a.appendTo(parent)
    a.attr('ctl-id', ctl['id'])
    a.attr('page-id', page['id'])
    a.attr('id', ctl['id'])
    a.on('click', function (e) {
        let a2 = recurse_parent($(e.target), 'ctl-id')
        action_trigger(a2)
    })

    if (ctl['icon']) {
        let i = $(`<i>`)
        i.addClass(ctl['icon'])
        i.appendTo(a)
    }

    let s = $(`<span>`)
    s.html(ctl['caption'])
    s.appendTo(a)
}

/*
 *  >>> ACTIONS IN CONTENT MODE
 *
 */

function render_actionarea_content(ctl, page) {
    let mnu = $("#menu-left")

    for (let c in ctl['controls']) {
        let ctl2 = ctl['controls'][c]

        if (ctl2['controlType'] == 'Action')
            render_action_actionarea_content(ctl2, mnu, page)
    }
}

function render_action_actionarea_content(ctl, parent, page) {
    let li = $(`
        <li class="nav-item">
            <a href="javascript:;" class="nav-link">
                <i></i>
                <span id="caption"></span>
            </a>
        </li>
    `)
    li.find('i').addClass(ctl['icon'])
    li.find('#caption').html(ctl['caption'])
    li.prop('id', ctl['id'])
    li.prop('menu-level', 0)
    li.attr('ctl-id', ctl['id'])
    li.attr('page-id', page['id'])
    li.on('click', function (e) {
        let a = recurse_parent($(e.target), 'ctl-id')
        action_trigger(a)
    })
    li.appendTo(parent)

    for (let c in ctl['controls']) {
        let ctl2 = ctl['controls'][c]

        if (ctl2['controlType'] == 'Action')
            render_action_action_content(ctl2, ctl, page)
    }
}

function render_action_action_content(ctl, parent, page) {
    let par = $('#' + parent['id'])
    par.off('click')
    let level = par.prop('menu-level') * 1 + 1

    let a = par.children('a')
    a.attr('data-toggle', 'dropdown')
    a.attr('aria-expanded', false)
    a.attr('aria-haspopup', true)
    a.addClass('dropdown-toggle')

    let ul = par.children('ul')
    if (ul.length == 0) {
        ul = $(`<ul class="dropdown-menu border-0 shadow"></ul>`)
        par.append(ul)
    }

    if (level == 1) {
        par.addClass('dropdown')

    } else {
        par.addClass('dropdown-submenu')
        par.addClass('dropdown-hover')
    }

    let li = $(`
        <li>
            <a href="javascript:;" class="dropdown-item">
                <i></i>
                <span id="caption"></span>
            </a>
        </li>
    `)
    li.find('i').addClass(ctl['icon'])
    li.find('#caption').html(ctl['caption'])
    li.prop('id', ctl['id'])
    li.prop('menu-level', level)
    li.attr('ctl-id', ctl['id'])
    li.attr('page-id', page['id'])
    li.on('click', function (e) {
        let a = recurse_parent($(e.target), 'ctl-id')
        action_trigger(a)
    })
    ul.append(li)

    for (let c in ctl['controls']) {
        let ctl2 = ctl['controls'][c]

        if (ctl2['controlType'] == 'Action')
            render_action_action_content(ctl2, ctl, page)
    }
}

/*
 *  >>> ACTIONS INSIDE CARD
 *
 */

function render_actionarea_card(ctl, parent, page) {
    let title = parent.find('.card-tools')

    let a = $(`<div class="card-tools"></div>`)
    a.css('float', 'left')
    parent.append(a)

    let ul = $(`<ul class="navbar-nav"></ul>`)
    ul.css('display', 'inline-block')
    ul.css('padding', '0px')
    ul.prependTo(a)

    for (let c in ctl['controls']) {
        let ctl2 = ctl['controls'][c]

        if (ctl2['controlType'] == 'Action')
            render_action_actionarea_content(ctl2, ul, page)
    }

    ul.find('.nav-link').css('padding-left', '0px')
    ul.find('.nav-link').css('padding-top', '0px')
    ul.find('.nav-link').css('padding-bottom', '0px')
}


/*
 *  >>> ACTIONS INSIDE NAVIGATION PANE
 *
 */

function render_actiongroup_navigationpane(ctl, page) {
    let li = $(`<li class="nav-header"></li>`)
    li.html(ctl['caption'])
    $('#sidemenu').append(li)

    for (let c in ctl['controls']) {
        let ctl2 = ctl['controls'][c]

        if (ctl2['controlType'] == 'Action')
            render_action_navigationpane(ctl2, page)
    }
}

function render_action_navigationpane(ctl, page) {
    let li = $(`
        <li class="nav-item">
            <a href="javascript:;" class="nav-link">
                <i class="nav-icon"></i>
                <p>
                    <span id="caption"></span>
                </p>
            </a>
        </li>
    `)

    li.find('i').addClass(ctl['icon'])
    li.find('#caption').html(ctl['caption'])
    li.attr('ctl-id', ctl['id'])
    li.attr('page-id', page['id'])
    li.attr('id', ctl['id'])
    li.on('click', function (e) {
        let a = recurse_parent($(e.target), 'ctl-id')
        action_trigger(a)
    })
    $('#sidemenu').append(li)

    for (let c in ctl['controls']) {
        let ctl2 = ctl['controls'][c]

        if (ctl2['controlType'] == 'Action')
            render_action_action_navigationpane(ctl2, ctl, page)
    }
}

function render_action_action_navigationpane(ctl, parent, page) {
    let cparent = $('#' + parent['id'])
    cparent.off('click')

    let ul = cparent.children('ul')
    if (ul.length == 0) {
        ul = $(`
            <ul class="nav nav-treeview">
        `)
        ul.appendTo(cparent)
    }

    let p = cparent.children('a').children('p')
    let img = p.children('i')
    if (img.length == 0) {
        img = $(`
            <i class="fas fa-angle-left right"></i>
        `)
        img.appendTo(p)
    }

    let li = $(`
        <li class="nav-item">
            <a href="javascript:;" class="nav-link">
                <i class="nav-icon"></i>
                <p>
                    <span id="caption"></span>
                </p>
            </a>
        </li>
    `)

    li.find('i').addClass(ctl['icon'])
    li.find('#caption').html(ctl['caption'])
    li.attr('ctl-id', ctl['id'])
    li.attr('page-id', page['id'])
    li.attr('id', ctl['id'])
    li.on('click', function (e) {
        let a = recurse_parent($(e.target), 'ctl-id')
        action_trigger(a)
    })
    li.appendTo(ul)

    for (let c in ctl['controls']) {
        let ctl2 = ctl['controls'][c]

        if (ctl2['controlType'] == 'Action')
            render_action_action_navigationpane(ctl2, ctl, page)
    }
}


/*
 *  >>> COMMON
 *
 */

function size_to_suffix(size) {
    if ((size == "ExtraSmall") || (size == "Small"))
        return "-sm";

    if ((size == "ExtraLarge") || (size == "Large"))
        return "-lg";

    return "";
}

function set_title(title) {
    if (client_status['application_name'] > '')
        document.title = title + ' | ' + client_status['application_name']
    else
        document.title = title
}

function action_trigger(obj) {
    rpc_post({
        'type': 'request',
        'objectid': obj.attr('page-id'),
        'method': 'ControlInvoke',
        'arguments': {
            'controlid': obj.attr('ctl-id'),
            'method': 'Trigger'
        }
    })
}

function handle_download(obj) {
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
        URL.revokeObjectURL(x)
    })
}

/*
 *  >>> UTILITY
 *
 */

function debug_log(line) {
    if (window.location.hostname == "localhost")
        console.log(line)
}

function recurse_parent(obj, attr) {
    if (obj.attr(attr))
        return obj

    if (obj.prop(attr))
        return obj;

    if (obj.parent().length == 0)
        return null
    else
        return recurse_parent(obj.parent(), attr)
}

/*
 *  >>> ERROR MODAL
 *
 */

function show_error(obj) {
    let div = $(`
    <div class="modal fade" data-backdrop="static">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h4 class="modal-title" id='title'></h4>
                    <button type="button" class="close" data-dismiss="modal">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
                <div class="modal-body">
                    <p id="message"></p>
                    <code id="stack"></code>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-primary" data-dismiss="modal" id='ok'></button>
                </div>
            </div>
        </div>
    </div>
    `)
    div.appendTo('body')
    div.find('#title').html('Error')
    div.find('#message').html(obj['message'])
    div.find('#ok').html('OK')
    div.prop('modal-id', uuidv4())

    let trace = ''
    for (let t in obj['trace'])
        trace += obj['trace'][t] + '<br/>'
    div.find('#stack').html(trace)

    div.on('hidden.bs.modal', function (e) {
        if (_network_error)
            location.reload()

        modal_closing(e)
    })

    div.modal('show')

    client_status['modals'].push(div)
}

/*
 *  >>> INITIALIZERS
 *
 */

function core_initialize() {
    $('body').prop("pageType", '')

    let psrc = new URLSearchParams(window.location.search)

    rpc_post({
        'type': 'request',
        'classname': 'Brayns.Shaper.Systems.ClientManagement',
        'method': 'Start',
        'arguments': {
            'page': psrc.has('page') ? psrc.get('page') : ''
        }
    })

    $(document).on('keydown', handle_shortcut)

    setTimeout(poll, 1000);
}

function poll() {
    rpc_post({
        'type': 'request',
        'classname': 'Brayns.Shaper.Systems.ClientManagement',
        'method': 'Poll',
        'arguments': {}
    }, function () {
        setTimeout(poll, 10000);
    })
}

function remove_wrappers() {
    let fc = $('body').children().first()
    if (fc.prop('tagName') != 'SCRIPT')
        fc.remove()
}

function show_page() {
    remove_wrappers()

    let bw = $(`
        <div class="wrapper">
            <nav class="main-header navbar navbar-expand-md navbar-light navbar-white">
                <div class="container">
                    <span class="navbar-brand">
                        <span class="brand-text font-weight-light" id="sideTitle"></span>
                    </span>
                    <div class="navbar-collapse">
                        <ul class="navbar-nav" id="menu-left">
                        </ul>
                    </div>
                </div>
            </nav>

            <div class="content-wrapper">
                <div class="content-header">
                    <div class="container">
                        <div class="row mb-2">
                            <div class="col-sm-6">
                                <h1 class="m-0" id="title"></h1>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="content">
                    <div class="container" id="container">

                    </div>
                </div>
            </div>
        </div>
    `)

    $('body').prepend(bw)
    $('body').prop('pageType', 'page')
    $('body').removeClass()
    $('body').addClass('hold-transition')
    $('body').addClass('layout-top-nav')
    $('body').addClass('text-sm')
    $('body').css('min-height', '')
    $('#indicator').css('display', 'none')
}

function show_start() {
    remove_wrappers()

    let bw = $(`
        <div class="wrapper">
            <div class="preloader flex-column justify-content-center align-items-center">
                <img class="animation__shake" src="public/client/logo60.png" height="60" width="60">
            </div>

            <nav class="main-header navbar navbar-expand navbar-white navbar-light">
                <ul class="navbar-nav" id="menu-left">
                </ul>

                <ul class="navbar-nav ml-auto" id="menu-right">
                </ul>
            </nav>

            <aside class="main-sidebar sidebar-dark-primary elevation-4">
                <div class="brand-link">
                    <span class="brand-text font-weight-light" id="sideTitle" style="display: none"></span>
                </div>

                <div class="sidebar">
                    <div class="user-panel mt-1 pb-1 mb-1 d-flex" id="userPanel">
                        <div class="info">
                            <a href="javascript:;" class="d-block" id="infoName"></a>
                        </div>
                    </div>
                    <nav class="mt-2">
                        <ul class="nav nav-pills nav-sidebar nav-flat flex-column" data-widget="treeview" role="menu"
                            data-accordion="false" id="sidemenu">
                        </ul>
                    </nav>
                </div>
            </aside>

            <div class="content-wrapper">
                <div class="content-header">
                    <div class="container-fluid">
                        <div class="row mb-2">
                            <div class="col-sm-12">
                                <h1 class="m-0" id="title"></h1>
                            </div>
                        </div>
                    </div>
                </div>
                <section class="content">
                    <div class="container-fluid" id="container">
                    </div>
                </section>
            </div>

            <footer class="main-footer" style='display: none'></footer>

            <aside class="control-sidebar control-sidebar-light" id="detail-area" style='bottom: 0px; padding: 4px; padding-top: 8px'>
                
            </aside>
        </div>
    `)

    $('body').prepend(bw)
    $('body').prop("pageType", 'start')
    $('body').removeClass()
    $('body').addClass('hold-transition')
    $('body').addClass('layout-fixed')
    $('body').addClass('layout-navbar-fixed')
    $('body').addClass('sidebar-collapse')
    $('body').addClass('control-sidebar-push-slide')
    $('body').addClass('text-sm')
    $('body').css('min-height', '')
    $('#indicator').css('display', 'none')

    // brand logo
    let img1 = $(`<img src='public/client/logo250w.png' class='brand-image'>`)
    img1.css('margin-left', '8px')
    img1.on('error', function (e) {
        $(e.target).hide()

        let img2 = $(`<img src='public/client/logo30w.png' class='brand-image'>`)
        img2.css('margin-left', '8px')
        img2.on('error', function (e) {
            $(e.target).hide()
            $('#sideTitle').css('margin-left', '8px')
        })
        $('.brand-link').prepend(img2)

        $('#sideTitle').show()
    })
    $('.brand-link').prepend(img1)
}

function show_login() {
    remove_wrappers()

    let bw = $(`
        <div class="wrapper">
            <div class="content-wrapper">
                <div class="content-header">
                    <div class="container" style="width: 360px; margin-top: 50px; margin-bottom: 20px">
                        <div class="row mb-2 justify-content-sm-center">
                            <div class="col-sm-auto" id="loginLogo">
                            </div>
                        </div>
                    </div>
                </div>

                <div class="content">
                    <div class="container" id="container" style="width: 360px">

                    </div>
                </div>
            </div>
        </div>
    `)

    $('body').prepend(bw)
    $('body').prop('pageType', 'login')
    $('body').removeClass()
    $('body').addClass('hold-transition')
    $('body').addClass('layout-top-nav')
    $('body').addClass('text-sm')
    $('body').css('min-height', '')
    $('#indicator').css('display', 'none')

    // login logo
    let img1 = $(`<img src='public/client/logo300.png'>`)
    img1.on('error', function (e) {
        $(e.target).hide()
    })
    img1.appendTo($("#loginLogo"))
}

/*
 *  >>> START
 *
 */

$(function () {
    core_initialize()
})

