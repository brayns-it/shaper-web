class Renderer {
    static getMap(type) {
        let map = {
            "Action": ControlAction,
            "ActionArea": ActionArea,
            "ActionGroup": ActionGroup,
            "AppCenter": AppCenter,
            "ContentArea": ContentArea,
            "DetailArea": DetailArea,
            "Field": ControlField,
            "Footer": PageFooter,
            "Grid": ControlGrid,
            "Group": ControlGroup,
            "Html": ControlDiv,
            "Indicator": PageIndicator,
            "NavigationPane": NavigationPane,
            "NotificationItem": NotificationItem,
            "Notifications": Notifications,
            "Search": ControlSearch,
            "Subpage": Subpage,
            "UserCenter": UserCenter
        }

        return map[type]
    }

    static prepareLogin() {
        let wrap = $(`
            <div class="wrapper">
                <div class="content-wrapper">
                    <div class="content-header">
                        <div class="container" style="width: 360px; margin-top: 50px; margin-bottom: 20px">
                            <div class="row mb-2 justify-content-sm-center">
                                <div class="col-sm-auto" ctl-id="logo">
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="content">
                        <div class="container" id="container" style="width: 360px">
                        </div>
                    </div>
                </div>
            </div>
        `)

        $('body').prepend(wrap)
        $('body').removeClass()
        $('body').addClass('hold-transition')
        $('body').addClass('layout-top-nav')
        $('body').addClass('text-sm')
        $('body').css('min-height', '')

        // login logo
        let img1 = $(`<img src='/public/client/logo300.png'>`)
        img1.on('error', (e) => {
            $(e.target).hide()
        })
        img1.appendTo(wrap.find('[ctl-id="logo"]'))
    }

    static prepareStart() {
        let wrap = $(`
            <div class="wrapper">
                <div class="preloader flex-column justify-content-center align-items-center">
                    <img class="animation__shake" src="/public/client/logo60.png" height="60" width="60">
                </div>

                <nav class="main-header navbar navbar-expand navbar-white navbar-light">
                    <ul class="navbar-nav" id="menu-left">
                    </ul>

                    <ul class="navbar-nav ml-auto" id="menu-right">
                    </ul>
                </nav>

                <aside class="main-sidebar sidebar-dark-primary elevation-4">
                    <div class="brand-link">
                        <span class="brand-text font-weight-light" id="sideTitle" style="display: none"></span>
                    </div>

                    <div class="sidebar">
                        <div class="user-panel mt-1 pb-1 mb-1 d-flex" id="userPanel">
                            <div class="info">
                                <a href="javascript:;" class="d-block" id="infoName"></a>
                            </div>
                        </div>
                        <nav class="mt-2">
                            <ul class="nav nav-pills nav-sidebar nav-flat flex-column" data-widget="treeview" role="menu"
                                data-accordion="false" id="sidemenu">
                            </ul>
                        </nav>
                    </div>
                </aside>

                <div class="content-wrapper">
                    <div class="content-header">
                        <div class="container-fluid">
                            <div class="row mb-2">
                                <div class="col-sm-12">
                                    <h1 class="m-0"></h1>
                                </div>
                            </div>
                        </div>
                    </div>
                    <section class="content">
                        <div class="container-fluid" id="container">
                        </div>
                    </section>
                </div>

                <footer class="main-footer" style='display: none'></footer>

                <aside class="control-sidebar control-sidebar-light" id="detail-area" style='bottom: 0px; padding: 4px'>
                
                </aside>
            </div>
        `)

        $('body').prepend(wrap)
        $('body').removeClass()
        $('body').addClass('hold-transition')
        $('body').addClass('layout-fixed')
        $('body').addClass('layout-navbar-fixed')
        $('body').addClass('sidebar-collapse')
        $('body').addClass('control-sidebar-push-slide')
        $('body').addClass('text-sm')
        $('body').css('min-height', '')

        // brand logo
        let img1 = $(`<img src='/public/client/logo250w.png' class='brand-image'>`)
        img1.css('margin-left', '8px')
        img1.on('error', (e) => {
            $(e.target).hide()

            let img2 = $(`<img src='/public/client/logo30w.png' class='brand-image'>`)
            img2.css('margin-left', '8px')
            img2.on('error', (e2) => {
                $(e2.target).hide()
                $('#sideTitle').css('margin-left', '8px')
            })
            $('.brand-link').prepend(img2)

            $('#sideTitle').show()
        })
        $('.brand-link').prepend(img1)
    }

    static preparePage() {
        let wrap = $(`
            <div class="wrapper">
                <nav class="main-header navbar navbar-expand-md navbar-light navbar-white">
                    <div class="container">
                        <span class="navbar-brand">
                            <span class="brand-text font-weight-light" id="sideTitle"></span>
                        </span>
                        <div class="navbar-collapse">
                            <ul class="navbar-nav" id="menu-left">
                            </ul>
                        </div>
                    </div>
                </nav>

                <div class="content-wrapper">
                    <div class="content-header">
                        <div class="container">
                            <div class="row mb-2">
                                <div class="col-sm-6">
                                    <h1 class="m-0"></h1>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="content">
                        <div class="container" id="container">
                        </div>
                    </div>
                </div>
            </div>
        `)

        $('body').prepend(wrap)
        $('body').removeClass()
        $('body').addClass('hold-transition')
        $('body').addClass('layout-top-nav')
        $('body').addClass('text-sm')
        $('body').css('min-height', '')
    }

    static page(obj) {
        // prepare outer html
        let initLayout = false
        if ($('.wrapper').length == 0) {
            switch (obj['pageType']) {
                case 'Normal':
                    Renderer.preparePage()
                    break

                case 'Start':
                    Renderer.prepareStart()
                    break

                case 'Login':
                    Renderer.prepareLogin()
                    break
            }

            initLayout = true
        }

        if (obj['applicationName']) {
            Client.applicationName = obj['applicationName']
            $('#sideTitle').html(obj['applicationName'])
        }

        let page = null

        if (obj['parentId'])
            page = new PageSubPage()

        else if (obj['display'] == 'content')
            page = new PageContent()

        else if (obj['display'] == 'modal')
            page = new PageModal()

        page.caption = obj['caption']
        page.id = obj['id']
        page.layout = obj
        page.show()

        if (initLayout) {
            Renderer.addControlSidebar()

            $('body').css('height', '')
            $('body').Layout('init')
        }
    }

    static addControlSidebar() {
        let li = $(`
            <li class="nav-item" id="control-sidebar-li">
                <a class="nav-link" data-widget="control-sidebar" id="control-sidebar" data-controlsidebar-slide="true" href="javascript:;" role="button">
                    <i class="fas fa-th-large"></i>
                </a>   
            </li>
        `)
        li.hide()

        $('#menu-right').append(li)
    }

    static hideAllPages() {
        let lastPage = null;
        let st = $(window).scrollTop()

        for (let i = 0; i < Client.pageStack.length; i++) {
            let page = Client.pageStack[i]
            if (page.constructor.name == 'PageContent') {
                page.uiElement.hide()
                lastPage = page;

                let menus = page.findItemsByProperty('isMenuAction', true)
                for (let j = 0; j < menus.length; j++)
                    menus[j].uiElement.hide()
            }
        }

        if (lastPage) 
            lastPage.scrollTop = st
    }

    static showLastPage() {
        for (let i = (Client.pageStack.length - 1); i >= 0; i--) {
            let page = Client.pageStack[i]
            if (page.constructor.name == 'PageContent') {
                page.uiElement.show()

                if (page.scrollTop)
                    $(window).scrollTop(page.scrollTop)

                let menus = page.findItemsByProperty('isMenuAction', true)
                for (let j = 0; j < menus.length; j++)
                    menus[j].uiElement.show()

                if (page.findItemsByProperty('classType', 'DetailArea').length == 0)
                    Renderer.hideSidebar()
                else
                    Renderer.showSidebar()

                return
            }
        }
    }

    static showSidebar() {
        $('#control-sidebar-li').show()
        setTimeout(() => $('.control-sidebar').ControlSidebar('show'), 500)
    }

    static hideSidebar() {
        $('.control-sidebar').ControlSidebar('collapse')
        $('#control-sidebar-li').hide()
    }

    static refreshTitle() {
        let title = $('.container-fluid').find('h1')
        title.empty()

        let pages = []
        for (let i = 0; i < Client.pageStack.length; i++)
            if (Client.pageStack[i].constructor.name == 'PageContent')
                pages.push(Client.pageStack[i])

        let currentPage = null
        for (let i = 0; i < pages.length; i++) {
            let page = pages[i]

            if (i == (pages.length - 1))
                currentPage = page

            if ((i == (pages.length - 1)) && (pages.length > 1)) {
                let a = $(`<a href="javascript:;"></a>`)
                a.html(page.layout['caption'])
                a.on('click', () => page.queryClose())
                a.appendTo(title)
            }
            else {
                let th = $(`<span></span>`)
                th.html(page.layout['caption'])
                th.appendTo(title)
            }

            if (i < (pages.length - 1)) {
                let span = $(`<span> &gt; </span>`)
                span.prop('is-separator', true)
                span.appendTo(title)
            }
        }

        Client.setTitle(currentPage.layout['caption'])

        if (currentPage.layout['showHeader'])
            $('.content-header').find('.container-fluid').show()
        else
            $('.content-header').find('.container-fluid').hide()
    }

    static handleUI(obj) {
        switch (obj['command']) {
            case 'redrawControl':
                Renderer.redrawControl(obj)
                break

            case 'closePage':
                Renderer.closePage(obj)
                break

            case 'setPageCaption':
                Renderer.setPageCaption(obj)
                break
        }
    }
    
    static setPageCaption(obj) {
        let page = Client.getPageById(obj['pageid'])
        if (page) {
            page.layout['caption'] = obj['value']
            Renderer.refreshTitle()
        }
    }

    static closePage(obj) {
        let page = Client.getPageById(obj['pageid'])
        if (page)
            page.close()
    }

    static redrawControl(obj) {
        let page = Client.getPageById(obj['pageid'])
        if (page) {
            let items = page.findItemsByProperty('id', obj['id'])
            if (items.length > 0)
                items[0].redraw(obj)
        }
    }
}