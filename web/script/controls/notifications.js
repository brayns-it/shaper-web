class Notifications extends ControlBase {
    show() {
        this.uiElement = $(`
            <li class="nav-item dropdown">
                <a class="nav-link" data-toggle="dropdown" href="javascript:;">
                    <i class="fas fa-bell"></i>
                    <span class="badge badge-danger navbar-badge" ctl-id='badge'></span>
                </a>
                <div class="dropdown-menu dropdown-menu-lg dropdown-menu-right">
                </div>
            </li>
        `)
        $('#menu-right').append(this.uiElement)

        this.uiBody = this.uiElement.find('.dropdown-menu')

        super.show()

        let c = 0
        for (let i in this.items)
            if (this.items[i].constructor.name == "NotificationItem")
                c++

        if (c > 0)
            this.uiElement.find('[ctl-id="badge"]').html(c)
        else
            this.uiElement.find('[ctl-id="badge"]').html('')
    }
}