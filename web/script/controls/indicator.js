class PageIndicator extends ControlBase {
    show() {
        let capt = this.layout['caption']
        if (capt == '')
            return

        this.uiElement = $(`
            <li class="nav-item" id="indicator">
                <span class="badge badge-info"></span>
            </li>
        `)
        this.uiElement.css('padding-top', '4px')
        this.uiElement.css('padding-left', '16px')
        this.uiElement.css('padding-right', '16px')
        this.uiElement.find('.badge').html(capt)
        this.uiElement.css('cursor', 'pointer')
        this.uiElement.on('click', () => {
            document.documentElement.requestFullscreen()
        })
        $('#menu-right').append(this.uiElement)

        super.show()
    }
}