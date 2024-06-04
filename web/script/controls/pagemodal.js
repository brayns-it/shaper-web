class PageModal extends PageBase {
    uiFooter = null

    show() {
        Client.leaveFocus()

        this.uiElement = $(`
            <div class="modal fade" data-backdrop="static">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h4 class="modal-title"></h4>
                            <button type="button" class="close">
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <div class="modal-body">
                        </div>
                        <div class="modal-footer">
                        </div>
                    </div>
                </div>
            </div>
        `)

        this.uiElement.find('.modal-title').html(this.layout['caption'])
        this.uiElement.appendTo('body')
        this.uiElement.on('hidden.bs.modal', () => this.modalClose)

        let sizeClass = 'modal-lg'
        if ((this.layout['unitType'] != "Brayns.Shaper.Systems.Confirm") && (this.layout['unitType'] != "Brayns.Shaper.Systems.Message") &&
            (this.layout['unitType'] != "Brayns.Shaper.Systems.Progress"))
            sizeClass = 'modal-xl'

        this.uiElement.find('.modal-dialog').addClass(sizeClass)

        this.uiBody = this.uiElement.find('.modal-body')
        this.uiFooter = this.uiElement.find('.modal-footer')

        let close = this.uiElement.find('.close')
        close.on('click', () => this.queryClose())

        this.uiElement.modal('show')
        super.show()

        this.uiElement.find('input').first().focus()
    }

    modalClose() {
        super.close()

        if (Client.lastFocus)
            Client.lastFocus.focus()

    }

    close() {
        // prevent modal remaining open if closed before shown
        this.uiElement.on('shown.bs.modal', () => this.uiElement.modal('hide'))

        this.uiElement.modal('hide')
    }
}