class PageSubPage extends PageBase {
    isDetail = false

    show() {
        this.uiElement = $(`<div class="row"></div>`)
        this.uiBody = this.uiElement
        
        this.uiParent = $('[ctl-id="' + this.layout['parentId'] + '"]')

        this.uiParent.append(this.uiElement)

        if (this.layout['parentType'] == 'DetailArea')
            this.isDetail = true

        super.show(null, ['ActionArea'])

        // assert action creation after controls
        super.show(['ActionArea'])
    }

    close() {
        super.close()
    }
}