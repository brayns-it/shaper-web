class NotificationItem extends ControlBase {
    click() {
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

    show() {
        this.uiElement = $(`
            <a href="javascript:;" class="dropdown-item">
                <div class="media">
                    <div class="media-body">
                        <h3 class="dropdown-item-title">
                            <span ctl-id='title'></span>
                            <span class="float-right text-sm text-muted"><i ctl-id='icon'></i></span>
                        </h3>
                        <p class="text-sm" ctl-id='description'></p>
                        <p class="text-sm text-muted"><i class="far fa-clock mr-1"></i><span ctl-id='ageValue'></span></p>
                    </div>
                </div>
            </a>
            <div class="dropdown-divider"></div>
        `)

        if (this.layout['title']) {
            this.uiElement.find('[ctl-id="title"]').html(this.layout['title'])
            this.uiElement.find('[ctl-id="icon"]').addClass(this.layout['icon'])
        } else
            this.uiElement.find('.dropdown-item-title').remove()

        this.uiElement.find('[ctl-id="description"]').html(this.layout['description'])
        this.uiElement.find('[ctl-id="ageValue"]').html(this.layout['dateTime'])

        this.uiElement.on('click', () => this.click())

        this.uiElement.appendTo(this.uiParent)

        super.show()
    }
}
