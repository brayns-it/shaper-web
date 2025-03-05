class ControlBase {
    id = ""
    items = []
    parent = null
    layout = {}
    uiElement = null
    uiParent = null
    uiBody = null
    page = null
    bindTo = null
    classType = null
    
    appendTo(parent, uiParent) {
        this.classType = this.constructor.name
        this.page = parent.page
        this.parent = parent
        this.parent.items.push(this)

        if (uiParent)
            this.uiParent = uiParent
        else
            this.uiParent = parent.uiBody
    }

    redraw(newLayout) {
        if (!this.uiElement)
            return

        this.layout = newLayout
        this.items = []

        let idx = this.uiElement.index()
        this.uiElement.remove()
        this.redrawShow()

        if (this.uiElement.index() != idx) {
            let ctl2 = this.uiElement.parent().children().eq(idx)
            ctl2.before(this.uiElement)
        }

        this.page.shortcutMask = []

        if (Client.lastFocus != null) {
            let id = Client.lastFocus.attr('id')
            let newCtl = $(`#` + id)
            if (newCtl.length > 0) {
                Client.lastFocus = newCtl
                Client.lastFocus.first().trigger('focus')
            }
        }
    }

    redrawShow() {
        this.show()
    }

    show(include, exclude) {
        // recurse controls
        if (this.layout['controls'])
            for (let c in this.layout['controls']) {
                let ctl = this.layout['controls'][c]

                if (include && (!include.includes(ctl['controlType'])))
                    continue

                if (exclude && exclude.includes(ctl['controlType']))
                    continue

                let itm = Renderer.getMap(ctl['controlType'])
                if (itm) {
                    itm = new itm()
                    itm.id = ctl['id']
                    itm.layout = ctl
                    itm.appendTo(this)
                    itm.show()
                }
            }
    }

    findItemsByProperty(propName, propValue, callback) {
        let results = []
        let ctls = this.items.slice()
        while (ctls.length) {
            let ct = ctls.pop()
            if (ct[propName] == propValue) {
                results.push(ct)

                if (callback)
                    callback(ct)
            }

            ctls = ctls.concat(ct.items.slice())
        }
        return results
    }
}