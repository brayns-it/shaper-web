class PageContent extends PageBase {
    show() {
        Client.leaveFocus()
        Renderer.hideAllPages()

        this.uiElement = $(`<div class="row"></div>`)
        this.uiBody = this.uiElement

        $("#container").append(this.uiElement)

        super.show()

        this.uiElement.find('input').first().focus()
        Renderer.refreshTitle()
    }
    
    close() {
        this.findItemsByProperty('isMenuAction', true, (item) => item.uiElement.remove())
        this.findItemsByProperty('classType', 'DetailArea', (item) => item.uiElement.remove())

        super.close()

        if (Client.lastFocus)
            Client.lastFocus.focus()

        Renderer.showLastPage()
        Renderer.refreshTitle()
    }
}