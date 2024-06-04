class PageBase extends ControlBase {
    onClose = null

    show(include, exclude) {
        this.page = this
        Client.pageStack.push(this)

        super.show(include, exclude)
    }

    queryClose() {
        if (!this.layout['id']) {
            this.close()
            return
        }

        Client.rpcPost({
            'type': 'request',
            'objectid': this.id,
            'method': 'QueryClose',
            'arguments': {
            }
        })
    }

    close() {
        if (this.onClose)
            this.onClose()

        if (this.uiElement)
            this.uiElement.remove()
          
        let newStack = []
        for (let i in Client.pageStack)
            if (Client.pageStack[i].id != this.id)
                newStack.push(Client.pageStack[i])
        Client.pageStack = newStack
    }

    getSchemaField(codename) {
        for (let n in this.layout['schema'])
            if (this.layout['schema'][n]['codename'] == codename)
                return this.layout['schema'][n];
        return null;
    }
}