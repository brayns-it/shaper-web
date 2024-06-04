class PageFooter extends ControlBase {
    show() {
        this.uiElement = $('.main-footer')

        if (this.layout['caption']) {
            this.uiElement.html(this.layout['caption'])
            this.uiElement.show()

        } else
            this.uiElement.hide()

        super.show()
    }
}