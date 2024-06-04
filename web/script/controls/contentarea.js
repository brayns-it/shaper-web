class ContentArea extends ControlBase {
    show() {
        if (this.parent.constructor.name == 'PageModal') {
            this.uiElement = $(`
                <div class="row">
                    <div class='col-12'>
                    </div>
                </div>
            `)

            this.parent.uiElement.find('.modal-body').append(this.uiElement)
            this.uiBody = this.uiElement.find('div')

        } else {
            this.uiElement = $(`<div class='col-12'></div>`)
            this.uiParent.append(this.uiElement)
            this.uiBody = this.uiElement
        }

        super.show()
    }
}