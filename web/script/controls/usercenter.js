class UserCenter extends ControlBase {
    show() {
        this.uiElement = $(`
            <li class="nav-item dropdown">
                <a class="nav-link" data-toggle="dropdown" href="javascript:;">
                    <i class="fas fa-cog"></i>
                </a>
                <div class="dropdown-menu dropdown-menu-lg dropdown-menu-right">
                    <span class="dropdown-item dropdown-header"></span>
                </div>
            </li>
        `)

        this.uiElement.find('span').html(this.layout['caption'])
        $('#menu-right').append(this.uiElement)

        this.uiBody = this.uiElement.find('.dropdown-menu')

        super.show()
    }
}