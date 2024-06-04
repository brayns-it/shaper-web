class DetailArea extends ControlBase {
    show() {
        this.uiElement = $(`<div>`)
        this.uiBody = this.uiElement
        $('#detail-area').append(this.uiElement)

        super.show()

        Renderer.showSidebar()
    }
}