class ControlField extends ControlBase {
    schema = null
    xValue = null
    getValue = null
    setValue = null
    valueIsRaw = false

    show() {
        this.bindTo = this.layout['codename']
        this.schema = this.page.getSchemaField(this.layout['codename'])

        if (this.page.isDetail)
            this.showDetail()
        else
            this.showNormal()

        super.show()
    }

    showDetail() {
        let row = $(`<div class="row">`)
        this.parent.uiBody.append(row)

        let label = $(`<div class="col-form-label font-weight-normal" style="padding-top: 0px" />`)
        label.addClass('col-sm')
        label.html(this.layout['caption'] + ':')
        label.appendTo(row)

        this.layout['readOnly'] = true

        this.uiParent = $(`<div />`)
        this.uiParent.addClass('col-sm')
        this.uiParent.appendTo(row)

        this.renderInputHtml()
    }

    showNormal() {
        let newRow = true

        let row = this.parent.uiBody.children('.row').last()
        if (row.length > 0) {
            if ((this.parent.layout['labelStyle'] == 'Horizontal') && (this.parent.layout['fieldPerRow'] == 'Two'))
                if (row.prop('ctl-count') == 1)
                    newRow = false

            if (newRow)
                row.css('margin-bottom', '6px')
        }

        if (newRow) {
            row = $(`<div>`)
            row.addClass("row")
            row.appendTo(this.parent.uiBody)
            row.prop('ctl-count', 1)
        } else {
            row.prop('ctl-count', 2)
        }

        let grp = $('<div class="form-group">')
        grp.css('margin-bottom', '0px')

        if (this.parent.layout['labelStyle'] == 'Horizontal')
            grp.addClass("row")
        if (this.parent.layout['fieldPerRow'] == 'One')
            grp.addClass("col-sm-12")
        else
            grp.addClass("col-sm-6")
        grp.appendTo(row)

        let hasLabel = true
        if (this.schema["fieldType"] == "BOOLEAN")
            hasLabel = false
        if (!this.layout['showCaption'])
            hasLabel = false
        if (this.parent.layout['labelStyle'] == "Placeholder")
            hasLabel = false

        if (hasLabel) {
            let label = $(`<label class="col-form-label font-weight-normal" style="padding-top: 0px"></label>`)
            label.attr('for', this.id)
            if (this.parent.layout['labelStyle'] == 'Horizontal')
                label.addClass('col-4')
            else
                label.addClass('col-12')
            label.addClass('text' + Client.sizeToSuffix(this.layout["fontSize"]))
            if (this.layout['caption'])
                label.html(this.layout['caption'] + ':')
            label.appendTo(grp)
        }

        this.uiParent = $(`<div />`)
        if ((this.parent.layout['labelStyle'] == 'Horizontal') && hasLabel)
            this.uiParent.addClass('col-8')
        else
            this.uiParent.addClass('col-12')

        // render control
        if (this.schema["hasRelations"])
            this.renderSelectExt()

        else if (this.schema["fieldType"] == "OPTION")
            this.renderSelect()

        else if (this.schema["fieldType"] == "BOOLEAN")
            this.renderCheckbox()

        else if (this.layout['inputType'] == "Html")
            this.renderInputHtml()

        else if (this.layout['inputType'] == "TextArea")
            this.renderTextarea()

        else
            this.renderInput()

        this.uiParent.appendTo(grp)
    }

    validate() {
        if (this.getValue() === this.xValue)
            return

        Client.rpcPost({
            'type': 'request',
            'objectid': this.page.id,
            'method': 'ControlInvoke',
            'arguments': {
                'controlid': this.id,
                'method': 'Validate',
                'args': {
                    'value': this.getValue(),
                    'parseValue': !this.valueIsRaw
                }
            }

        }, null, () => {
            if (this.setValue)
                this.setValue(this.xValue)

        })
    }

    renderInputHtml() {
        if (this.layout['readOnly']) {
            this.uiElement = $(`<div>`)
            this.uiElement.addClass('text' + Client.sizeToSuffix(this.layout["fontSize"]))
            this.uiElement.appendTo(this.uiParent)

            this.getValue = () => { return this.uiElement.html() }
            this.setValue = (val) => { this.uiElement.html(val) }
        } else {
            // TODO
        }
    }

    renderInput() {
        this.uiElement = $(`<input class="form-control" role="presentation">`)
        this.uiElement.addClass("form-control" + Client.sizeToSuffix(this.layout["fontSize"]))
        this.uiElement.attr('id', this.id)

        if (this.page.layout['pageType'] != "Login")
            this.uiElement.attr('autocomplete', 'new-password')

        if (this.layout['inputType'] == 'Password')
            this.uiElement.attr('type', 'password')

        if (this.layout['readOnly'])
            this.uiElement.attr('readonly', true)
        else {
            this.uiElement.on('focus', () => Client.lastFocus = this.uiElement)
            this.uiElement.on('change', () => this.validate())
        }

        this.getValue = () => { return this.uiElement.val() }
        this.setValue = (val) => { this.uiElement.val(val) }

        if (this.layout['placeholder'])
            this.uiElement.attr("placeholder", this.layout["caption"])

        let group = null

        if (this.schema["fieldType"] == "DATE") {
            group = $(`<div class="input-group date" data-target-input="nearest">`)
            group.attr('id', this.id + '-group')
            this.uiElement.addClass("datetimepicker-input")
            this.uiElement.attr("data-target", '#' + this.id + '-group')
            this.uiElement.appendTo(group)
            group.appendTo(this.uiParent)

            let tgl = $(`
                <div class="input-group-append" data-toggle="datetimepicker">
                    <div class="input-group-text"><i class="fas fa-calendar-days"></i></div>
                </div>
            `)
            tgl.attr("data-target", '#' + this.id + '-group')
            tgl.appendTo(group)

            group.datetimepicker({
                locale: this.page.layout['locale'],
                format: 'L'
            })

            group.on('change.datetimepicker', () => this.validate())
        }

        if (!group)
            this.uiElement.appendTo(this.uiParent)
    }

    renderCheckbox() {
        let div = $(`<div class="form-check" style='height: 30px'>`)
        div.appendTo(this.uiParent)

        this.uiElement = $(`<input type="checkbox" class="form-check-input">`)
        this.uiElement.attr('id', this.id)
        this.uiElement.appendTo(div)

        if (this.layout['readOnly']) {
            this.uiElement.attr('disabled', '')
        } else {
            this.uiElement.on('focus', () => Client.lastFocus = this.uiElement)
            this.uiElement.on('change', () => this.validate())
        }

        this.getValue = () => { return this.uiElement.prop('checked') }
        this.setValue = (val) => { this.uiElement.prop('checked', val) }

        this.valueIsRaw = true

        let lab = $(`<label class="form-check-label">`)
        lab.attr('for', this.id)
        lab.html(this.layout['caption'])
        lab.appendTo(div)
    }

    renderSelect() {
        if (this.layout['readOnly']) {
            this.renderInput()
            return
        }

        this.valueIsRaw = true

        this.uiElement = $(`<select class="form-control custom-select-sm">`)
        this.uiElement.css('font-size', '.875rem')

        for (let i in this.schema['options']) {
            let opt = $(`<option class='selectize-option'>`)
            opt.attr('value', this.schema['options'][i]['value'])
            if (this.schema['options'][i]['caption'])
                opt.html(this.schema['options'][i]['caption'])
            else
                opt.html('&nbsp;')
            opt.appendTo(this.uiElement)
        }

        this.getValue = () => { return this.uiElement[0].selectize.getValue() * 1 }
        this.setValue = (val) => { this.uiElement[0].selectize.setValue(val, true) }

        this.uiElement.on('focus', () => Client.lastFocus = this.uiElement)

        this.uiElement.appendTo(this.uiParent)
        this.uiElement.selectize({
            openOnFocus: false,
            onChange: () => this.validate()
        })
    }

    searchRelated(query, callback) {
        Client.rpcPost({
            'type': 'request',
            'objectid': this.page.id,
            'method': 'ControlInvoke',
            'arguments': {
                'controlid': this.id,
                'method': 'GetValues',
                'args': {
                    'text': query
                }
            }
        }, (r) => {
            let data = []
            data.push({
                query: "",
                value: "",
                caption: ""
            })

            if (r)
                for (let i = 0; i < r.length; i++) {
                    let item = {}

                    item['query'] = query
                    item['value'] = r[i]["value"]
                    if (r[i]["hasFormat"])
                        item['caption'] = r[i]["fvalue"]
                    else
                        item['caption'] = r[i]["value"]
                    item['display'] = r[i]["display"]

                    data.push(item)
                }

            callback(data)
        })
    }

    renderSelectExt() {
        if (this.layout['readOnly']) {
            this.renderInput()
            return
        }

        this.uiElement = $(`<select class="form-control form-control-sm">`)
        this.uiElement.appendTo(this.uiParent)
        this.uiElement.selectize({
            valueField: "value",
            labelField: "caption",
            searchField: "query",
            selectOnTab: true,
            maxItems: 1,
            create: false,
            openOnFocus: false,
            render: {
                item: (i) => {
                    let sel = $(`<div>`)
                    sel.html(i.caption)
                    return sel.prop('outerHTML')
                },
                option: (i) => {
                    let row = $(`<div class='row'>`)
                    row.css('padding', '4px')
                    if (i["display"]) {
                        for (let j = 0; j < i["display"].length; j++) {
                            let col = $(`<div class='col'>`)
                            col.html(i["display"][j])
                            col.appendTo(row)
                        }
                    } else {
                        let col = $(`<div class='col'>`)
                        col.html("&nbsp;")
                        col.appendTo(row)
                    }
                    return row.prop('outerHTML')
                }
            },
            onDropdownOpen: () => {
                if (!this.uiElement.prop('_loaded')) {
                    this.uiElement.prop('_loaded', true)

                    this.uiElement[0].selectize.close()
                    let currOpt = this.uiElement[0].selectize.getValue()

                    this.searchRelated(currOpt, (data) => {
                        this.uiElement[0].selectize.clear(true)
                        this.uiElement[0].selectize.clearOptions(true)
                        this.uiElement[0].selectize.addOption(data)
                        this.uiElement[0].selectize.refreshOptions(true)
                        this.uiElement[0].selectize.setValue(currOpt, true)
                        this.uiElement[0].selectize.open()

                        this.uiElement.prop('_loaded', false)
                    })
                }
            },
            load: (query, callback) => {
                this.uiElement[0].selectize.clearOptions()
                this.searchRelated(query, (data) => {
                    this.uiElement.prop('_loaded', true)
                    callback(data)
                    this.uiElement.prop('_loaded', false)
                })
            },
            onChange: (value) => {
                this.validate(value)
            }
        })

        this.uiElement[0].selectize.$control_input.on('focus', () => {
            // remove selected empty option when value is empty
            if (this.uiElement[0].selectize.getValue() == "")
                this.uiElement[0].selectize.clear()
        })

        this.getValue = () => { return this.uiElement[0].selectize.getValue() }
        this.setValue = (val) => {
            this.uiElement[0].selectize.clearOptions(true)
            this.uiElement[0].selectize.addOption({ value: val, caption: val })
            this.uiElement[0].selectize.setValue(val, true)
        }
    }

    renderTextarea() {
        this.uiElement = $(`<textarea class="form-control" rows="10" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">`)
        this.uiElement.addClass("form-control" + Client.sizeToSuffix(this.layout["fontSize"]))

        if (this.layout['readOnly'])
            this.uiElement.attr('readonly', true)
        else {
            this.uiElement.on('focus', () => Client.lastFocus = this.uiElement)
            this.uiElement.on('change', () => this.validate())
        }

        if (this.layout['fontFixed'])
            this.uiElement.css('font-family', 'monospace')

        if (this.layout['placeholder'])
            inp.attr("placeholder", this.layout["caption"])

        this.getValue = () => { return this.uiElement.val() }
        this.setValue = (val) => { this.uiElement.val(val) }

        this.uiElement.appendTo(this.uiParent)
    }
}