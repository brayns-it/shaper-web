class AppCenter extends ControlBase {
    show() {
        $('#sidemenu').empty()
        $('body').addClass('sidebar-collapse')
        $('#menu-left').empty()

        super.show()

        $('body').Layout('init')
        $('[data-widget="treeview"]').Treeview('init')
    }
}