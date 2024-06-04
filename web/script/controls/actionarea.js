class ActionArea extends ControlBase {
    show() {
        if (this.parent.constructor.name == 'PageModal')
            this.uiBody = this.parent.uiElement.find('.modal-footer')
        else if (this.parent.constructor.name == 'PageContent')
            this.uiBody = $("#menu-left")
        else if (this.parent.constructor.name == 'PageSubPage')
            this.renderSubPage()

        super.show()
    }

    renderSubPage() {
        this.uiParent = this.page.uiParent.find('.card-header').first()

        this.uiElement = $(`<div class="card-tools"><ul class="navbar-nav"></ul></div>`)
        this.uiElement.css('float', 'left')
        this.uiParent.append(this.uiElement)

        this.uiBody = this.uiElement.find('ul')
        this.uiBody.css('display', 'inline-block')
        this.uiBody.css('padding', '0px')
    }
}