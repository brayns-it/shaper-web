class NavigationPane extends ControlBase {
    show() {
        $('body').removeClass('sidebar-collapse')

        if (this.layout['caption'] > '') {
            $('#userPanel').show()
            $('#infoName').html(this.layout['caption'])
        } else {
            $('#userPanel').hide()
        }

        this.uiElement = $(`
            <li class="nav-item" id="pushmenu">
                <a class="nav-link" data-widget="pushmenu" href="javascript:;" role="button"><i class="fas fa-bars"></i></a>
            </li>
        `)
        $('#menu-left').append(this.uiElement)

        super.show()
    }
}