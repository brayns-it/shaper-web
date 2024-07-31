class ControlGrid extends ControlBase {
    columns = []
    count = 0
    limitRows = 0
    selection = []
    xSelection = []
    selColor = '#007bff'

    requestData(direction) {
        Client.rpcPost({
            'type': 'request',
            'objectid': this.page.id,
            'method': 'GetData',
            'arguments': {
                'direction': direction
            }
        })
    }

    requestSearch(what) {
        Client.rpcPost({
            'type': 'request',
            'objectid': this.page.id,
            'method': 'Search',
            'arguments': {
                'text': what
            }
        })
    }

    requestSort(th, codename) {
        let i = th.find('i')
        let asc = true

        if (i.hasClass('fa-chevron-up')) {
            i.removeClass('fa-chevron-up')
            i.addClass('fa-chevron-down')
            asc = false

        } else if (i.hasClass('fa-chevron-down')) {
            i.removeClass('fa-chevron-down')
            i.hide()

        } else {
            // reset sort icon on all columns
            let thead = this.uiElement.find('thead')
            thead.find('i').removeClass('fa-chevron-down')
            thead.find('i').removeClass('fa-chevron-up')
            thead.find('i').hide()

            i.addClass('fa-chevron-up')
            i.show()
        }

        Client.rpcPost({
            'type': 'request',
            'objectid': this.page.id,
            'method': 'Sort',
            'arguments': {
                'sortBy': codename,
                'ascending': asc
            }
        })
    }

    requestTrigger(fieldid, row) {
        Client.rpcPost({
            'type': 'request',
            'objectid': this.page.id,
            'method': 'ControlInvoke',
            'arguments': {
                'controlid': fieldid,
                'method': 'Trigger',
                'args': {
                    'row': row
                }
            }
        })
    }

    show() {
        this.uiElement = $(`
            <div class="card card-light">
                <div class="card-header">
                    <h3 class="card-title"></h3>
                    <div class="card-tools">
                        <div style="display: inline-block" ctl-id="searchBlock">
                            <div class="input-group input-group-sm">
                                <input type="text" class="form-control" ctl-id="searchBox">
                                <div class="input-group-append">
                                    <button type="submit" class="btn btn-default" ctl-id="searchBtn">
                                        <i class="fas fa-search"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div style="display: inline-block" ctl-id="pagination">
                            <div class="input-group input-group-sm">
                                <div class="input-group-append">
                                    <button type="submit" class="btn btn-default" ctl-id="first">
                                        <i class="fas fa-backward-fast"></i>
                                    </button>
                                    <button type="submit" class="btn btn-default" ctl-id="previous">
                                        <i class="fas fa-caret-left"></i>
                                    </button>
                                    <button type="submit" class="btn btn-default" ctl-id="next">
                                        <i class="fas fa-caret-right"></i>
                                    </button>
                                    <button type="submit" class="btn btn-default" ctl-id="last">
                                        <i class="fas fa-forward-fast"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <button type="button" class="btn btn-tool" data-card-widget="collapse">
                            <i class="fas fa-minus"></i>
                        </button>
                    </div>
                </div>
                <div class="card-body table-responsive p-0">
                    <table class="table table-hover text-nowrap">
                        <thead>
                            <tr></tr>
                        </thead>
                        <tbody>
                        </tbody>
                    </table>
                </div>
            </div>
        `)

        this.uiElement.find('[ctl-id="first"]').on('click', () => this.requestData('first'))
        this.uiElement.find('[ctl-id="previous"]').on('click', () => this.requestData('previous'))
        this.uiElement.find('[ctl-id="next"]').on('click', () => this.requestData('next'))
        this.uiElement.find('[ctl-id="last"]').on('click', () => this.requestData('last'))

        let searchBox = this.uiElement.find('[ctl-id="searchBox"]')
        searchBox.on('keydown', (evt) => {
            if ((evt.key == 'Enter') || (evt.key == 'NumpadEnter')) {
                this.requestSearch(searchBox.val())
                evt.preventDefault()
                return false
            }
        })

        this.uiElement.find('[ctl-id="searchBtn"]').on('click', () => this.requestSearch(searchBox.val()))

        let head = this.uiElement.find("thead").find("tr")

        let selTh = $(`<th class="table-row-selector"></th>`)
        selTh.css('padding', '0px')
        selTh.on('click', () => this.toggleAllSelection())
        head.append(selTh)

        for (let c in this.layout['controls']) {
            let field = this.layout['controls'][c]
            if (field['controlType'] != 'Field')
                continue

            let th = $(`<th>`)

            if ((field['fieldType'] == 'DECIMAL') || (field['fieldType'] == 'INTEGER'))
                th.css('text-align', 'right')

            let sort = $(`<a href='javascript:;'>`)
            sort.html(field['caption'])
            sort.appendTo(th)
            sort.on('click', () => this.requestSort(th, field['codename']))

            let i = $(`<i class="fas"></i>`)
            i.css("padding-left", "5px")
            i.css("font-size", ".75em")
            i.appendTo(th)
            i.hide()

            if (this.page.isDetail)
                th.css('text-wrap', 'wrap')

            th.css('padding-top', '6px')
            th.css('padding-bottom', '6px')
            head.append(th)

            this.columns.push(field)
        }

        if (this.page.isDetail)
            this.uiElement.find('[ctl-id="searchBlock"]').hide()

        this.uiParent.append(this.uiElement)
    }

    loadRow(obj, data) {
        let row = this.uiElement.find('[ctl-id="row-' + obj['selectedrow'] + '"]')
        for (let j = 0; j < this.columns.length; j++) {
            let col = row.find('[ctl-id="col-' + j + '"]')
            this.setColumnContent(this.columns[j], col, data[0])
        }
    }

    loadData(obj, data) {
        this.unselectAllRows()

        let tbody = this.uiElement.find("tbody")
        tbody.empty()
        this.count = 0

        if (data.length == 0) {
            let nodata_row = $(`<tr><td></td></tr>`)
            let nodata = nodata_row.find('td')
            nodata.attr("colspan", this.columns.length)
            nodata.html(this.layout['labelNodata'])
            nodata_row.appendTo(tbody)
        }

        for (let i = 0; i < data.length; i++) {
            let row = $(`<tr>`)
            row.attr('ctl-id', 'row-' + i)
            row.on('click', () => {
                this.unselectAllRows()
                this.selectRow(i)
            })

            let selTh = $(`<td class="table-row-selector"></td>`)
            selTh.css('padding', '0px')
            selTh.on('click', (e) => {
                this.toggleRowSelection(i)
                e.preventDefault()
                return false
            })
            row.append(selTh)

            for (let j = 0; j < this.columns.length; j++) {
                let col = $(`<td>`)
                col.attr("ctl-id", "col-" + j)

                if (this.columns[j].isLink) {
                    let a = $(`<a>`)
                    a.attr('href', '#')
                    a.on('click', (e) => {
                        this.requestTrigger(this.columns[j].id, i)
                        e.preventDefault()
                        return false
                    })
                    col.append(a)
                }

                if ((this.columns[j].fieldType == 'DECIMAL') || (this.columns[j].fieldType == 'INTEGER'))
                    col.css('text-align', 'right')
                col.css('padding-top', '6px')
                col.css('padding-bottom', '6px')
                col.appendTo(row)

                this.setColumnContent(this.columns[j], col, data[i])
            }
            row.appendTo(tbody)

            this.count++
        }

        this.limitRows = obj['limitRows']
        this.togglePagination()
    }

    setColumnContent(column, uiColumn, row) {
        let content = row[column.codename]['fValue']

        if (column.isLink)
            uiColumn.find('a').html(content)
        else
            uiColumn.html(content)
    }

    unselectAllRows() {
        this.uiElement.find('thead').find(".table-row-selector").css("background-color", '')
        for (let n in this.selection) {
            let td = this.uiElement.find('[ctl-id="row-' + this.selection[n] + '"]')
            td.find(".table-row-selector").css("background-color", '')
        }
        this.selection = []
        this.requestSelect()
    }

    toggleAllSelection() {
        if (this.selection.length < this.count) {
            this.selection = []
            for (let i = 0; i < this.count; i++)
                this.selection.push(i)

            this.uiElement.find('.table-row-selector').css("background-color", this.selColor)

        } else {
            this.selection = []
            this.uiElement.find('.table-row-selector').css("background-color", '')
        }
        this.requestSelect()
    }

    toggleRowSelection(rowNo) {
        let sel = false
        if (!this.selection.includes(rowNo)) {
            this.selection.push(rowNo)
            sel = true
        } else {
            let newSel = []
            for (let n in this.selection)
                if (this.selection[n] != rowNo)
                    newSel.push(this.selection[n])
            this.selection = newSel
        }

        let td = this.uiElement.find('[ctl-id="row-' + rowNo + '"]')
        td.find(".table-row-selector").css("background-color", (sel) ? this.selColor : '')

        this.requestSelect()
    }

    selectRow(rowNo) {
        if (!this.selection.includes(rowNo))
            this.selection.push(rowNo)

        let td = this.uiElement.find('[ctl-id="row-' + rowNo + '"]')
        td.find(".table-row-selector").css("background-color", this.selColor)

        this.requestSelect()
    }

    requestSelect() {
        if (Functions.arrayAreEquals(this.selection, this.xSelection))
            return

        Client.rpcPost({
            'type': 'request',
            'objectid': this.page.id,
            'method': 'SelectRows',
            'arguments': {
                'rows': this.selection
            }
        })

        this.xSelection = this.selection.slice()
    }

    togglePagination() {
        if (this.page.isDetail) {
            this.uiElement.find('[ctl-id="pagination"]').hide()
            return
        }

        if (this.count < this.limitRows)
            this.uiElement.find('[ctl-id="pagination"]').hide()
        else
            this.uiElement.find('[ctl-id="pagination"]').show()
    }
}