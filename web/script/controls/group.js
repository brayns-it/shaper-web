class ControlGroup extends ControlBase {

    getOrcreateFooter() {
        let foot = this.uiElement.find('.card-footer')
        if (foot.length == 0) {
            foot = $(`<div class="card-footer" />`)
            foot.appendTo(this.uiElement)
        }
        return foot
    }

    show() {
        this.uiElement = $(`
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title"></h3>
                </div>
                <div class="card-body">
                </div>
            </div>
        `)

        if (this.layout['primary'])
            this.uiElement.addClass('card-primary')
        else
            this.uiElement.addClass('card-light')

        if (this.layout['collapsible']) {
            let tools = $(`
                <div class="card-tools">
                    <button type="button" class="btn btn-tool" data-card-widget="collapse">
                        <i class="fas fa-minus"></i>
                    </button>
                </div>
            `)
            this.uiElement.find('.card-header').append(tools)
        }

        this.uiElement.find('.card-title').html(this.layout['caption'])
        this.uiElement.find('.card-title').addClass('text' + Client.sizeToSuffix(this.layout['fontSize']))

        if (this.page.isDetail)
            this.uiElement.find(".card-body").css('padding', '8px')
        
        this.uiBody = this.uiElement.find('.card-body')

        if (this.uiParent)
            this.uiParent.append(this.uiElement)

        super.show()
    }
}