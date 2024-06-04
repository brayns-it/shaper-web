class ActionGroup extends ControlBase {
    renderNavigationPane() {
        this.uiElement = $(`<li class="nav-header"></li>`)
        this.uiElement.html(this.layout['caption'])
        
        $('#sidemenu').append(this.uiElement)
    }

    renderGroup() {
        this.uiElement = $(`<div class="row">`)
        this.uiElement.appendTo(this.uiParent)
        this.uiBody = this.uiElement
    }

    show() {
        if (this.parent.constructor.name == 'NavigationPane')
            this.renderNavigationPane()

        else if (this.parent.constructor.name == 'ControlGroup')
            this.renderGroup()

        super.show()
    }
}