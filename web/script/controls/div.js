class ControlDiv extends ControlBase {
    show() {
        if (this.layout['style'] == 'code')
            this.uiElement = $(`<code>`)
        else
            this.uiElement = $(`<div>`)

        this.uiElement.html(this.layout['content'])

        if (this.uiParent)
            this.uiParent.append(this.uiElement)

        super.show()
    }
}