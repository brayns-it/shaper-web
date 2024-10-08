class ControlAction extends ControlBase {
    onClick = null
    shortcut = null
    isChild = false
    isMenuAction = false

    click() {
        if (Client.requestFullscreen)
            document.documentElement.requestFullscreen()

        if (this.onClick)
            this.onClick()
        else
            Client.rpcPost({
                'type': 'request',
                'objectid': this.page.id,
                'method': 'ControlInvoke',
                'arguments': {
                    'controlid': this.id,
                    'method': 'Trigger'
                }
            })
    }

    appendTo(parent, uiParent) {
        if (parent.constructor.name == "ControlGroup")
            uiParent = parent.getOrcreateFooter()

        super.appendTo(parent, uiParent)
    }

    renderAppButton() {
        this.uiElement = $(`<a class="btn btn-app" href="javascript:;" />`)
        this.uiElement.on('click', () => this.click())

        if (this.layout['icon']) {
            let i = $(`<i>`)
            i.addClass(this.layout['icon'])
            i.appendTo(this.uiElement)
        }

        let s = $(`<span>`)
        s.html(this.layout['caption'])
        s.appendTo(this.uiElement)

        this.uiParent.append(this.uiElement)
    }

    renderButton() {
        if (this.isChild) {
            this.uiParent.find('button').addClass('dropdown-toggle')
            this.uiParent.find('button').attr('data-toggle', 'dropdown')
            this.uiParent.find('button').off('click')

            let div = this.uiParent.children('.dropdown-menu')
            if (div.length == 0) {
                div = $(`<div class="dropdown-menu"></div>`)
                this.uiParent.append(div)
            }

            this.uiElement = $(`<a class="dropdown-item" href="javascript:;"></a>`)
            this.uiElement.html(this.layout['caption'])
            this.uiElement.on('click', () => this.click())
            div.append(this.uiElement)

        } else {
            this.uiElement = $(`
                <div class="btn-group">
                    <button type="button" class="btn"></button>
                </div>
            `)
            this.uiBody = this.uiElement

            this.uiElement.find('button').html(this.layout['caption'])

            // color: primary | success | warning | danger ...
            if (!this.layout['color']) this.layout['color'] = 'default'
            this.uiElement.find('button').addClass('btn-' + this.layout['color'])

            if (this.layout['isCancelation'])
                this.uiElement.on('click', () => Client.rpcCancel())
            else
                this.uiElement.on('click', () => this.click())

            this.uiElement.addClass('float-right')

            let space = $(`<span>`)
            space.html('&nbsp;')
            space.addClass('float-right')

            if (this.parent.constructor.name == "ControlGroup") {
                space.prependTo(this.uiParent)
                this.uiParent.prepend(this.uiElement)
            } else {
                space.appendTo(this.uiParent)
                this.uiParent.append(this.uiElement)
            }
        }
    }

    renderSystemMenu() {
        this.uiElement = $(`
            <div class="dropdown-divider"></div>
            <a href="javascript:;" class="dropdown-item">
                <i></i><span></span>
            </a>
        `)

        if (this.layout['icon']) {
            this.uiElement.find('i').addClass(this.layout['icon'])
            this.uiElement.find('i').addClass('mr-2')
        }

        this.uiElement.find('span').html(this.layout['caption'])
        this.uiElement.on('click', () => this.click())

        this.uiParent.append(this.uiElement)
    }

    renderNavigationPane() {
        let parent = null
        if (this.isChild) {
            this.parent.uiElement.off('click')

            parent = this.uiParent.children('ul')
            if (parent.length == 0) {
                parent = $(`<ul class="nav nav-treeview">`)
                parent.appendTo(this.uiParent)
            }

            let a = this.uiParent.children('a')
            let img = a.find('[ctl-id="expand"]')
            if (img.length == 0) {
                img = $(`<i class="fas fa-angle-left right" ctl-id="expand"></i>`)
                img.appendTo(a)
            }
        }

        this.uiElement = $(`
            <li class="nav-item">
                <a href="javascript:;" class="nav-link">
                    <i class="nav-icon"></i>
                    <span></span>
                </a>
            </li>
        `)

        this.uiElement.on('click', () => this.click())
        this.uiElement.find('i').addClass(this.layout['icon'])
        this.uiElement.find('span').html(this.layout['caption'])

        this.uiBody = this.uiElement

        if (this.isChild)
            parent.append(this.uiElement)
        else
            $('#sidemenu').append(this.uiElement)
    }

    renderMenu() {
        let parent = null
        if (this.isChild) {
            this.parent.uiElement.off('click')

            let a = this.parent.uiElement.children('a')
            a.attr('data-toggle', 'dropdown')
            a.attr('aria-expanded', false)
            a.attr('aria-haspopup', true)
            a.addClass('dropdown-toggle')

            parent = this.parent.uiElement.children('ul')
            if (parent.length == 0) {
                parent = $(`<ul class="dropdown-menu border-0 shadow"></ul>`)
                this.parent.uiElement.append(parent)
            }

            if (this.getLevel() == 1)
                this.parent.uiElement.addClass('dropdown')
            else {
                this.parent.uiElement.addClass('dropdown-submenu')
                this.parent.uiElement.addClass('dropdown-hover')
            }
        }
        else
            this.isMenuAction = true

        this.uiElement = $(`
            <li class="nav-item">                                 
                <a href="javascript:;">
                    <i class="nav-icon"></i>
                    <span></span>
                </a>
            </li>
        `)

        this.uiElement.find('a').addClass(this.isChild ? 'dropdown-item' : 'nav-link')
        this.uiElement.on('click', () => this.click())
        this.uiElement.find('i').addClass(this.layout['icon'])
        this.uiElement.find('span').html(this.layout['caption'])

        this.uiBody = this.uiElement

        if (this.isChild)
            parent.append(this.uiElement)
        else if (this.isFromParent("PageSubPage")) {
            this.uiElement.find('a').css('padding-left', '0px')
            this.uiElement.find('a').css('padding-top', '0px')
            this.uiElement.find('a').css('padding-bottom', '0px')
            this.uiParent.append(this.uiElement)
        } else
            $('#menu-left').append(this.uiElement)
    }

    getLevel() {
        let n = 0
        let p = this.parent
        while (p) {
            if (p.constructor.name == "ControlAction")
                n++
            else
                break
            p = p.parent
        }
        return n
    }

    isFromParent(type) {
        let p = this.parent
        while (p) {
            if (p.constructor.name == type)
                return true
            p = p.parent
        }
        return false
    }

    show() {
        this.shortcut = this.layout['shortcut']

        if (this.parent.constructor.name == "ControlAction")
            this.isChild = true

        if (this.isFromParent('NavigationPane'))
            this.renderNavigationPane()

        else if (this.isFromParent('UserCenter') || this.isFromParent('Notifications'))
            this.renderSystemMenu()

        else if (this.isFromParent('ActionGroup'))
            this.renderAppButton()

        else if (this.isFromParent('ControlGroup') || this.isFromParent('PageModal'))
            this.renderButton()

        else if (this.isFromParent('ActionArea'))
            this.renderMenu()


        super.show()
    }
}