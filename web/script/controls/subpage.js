class Subpage extends ControlBase {
    show() {
        this.uiElement = $(`<div>`)
        this.uiElement.attr("ctl-id", this.id)

        this.uiBody = this.uiElement
        this.uiParent.append(this.uiElement)
    }
}