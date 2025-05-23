﻿class PageContent extends PageBase {
    scrollTop = null

    show() {
        Client.leaveFocus()
        Renderer.hideAllPages()

        this.uiElement = $(`<div class="row"></div>`)
        this.uiBody = this.uiElement

        $("#container").append(this.uiElement)

        super.show()

        this.uiElement.find('input').first().trigger('focus')
        Renderer.refreshTitle()
    }
    
    close() {
        this.findItemsByProperty('isMenuAction', true, (item) => item.uiElement.remove())
        this.findItemsByProperty('classType', 'DetailArea', (item) => item.uiElement.remove())

        super.close()

        Renderer.showLastPage()
        Renderer.refreshTitle()

        if (Client.lastFocus != null)
            Client.lastFocus.first().trigger('focus')
    }
}