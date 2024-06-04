class ClientData {
    static handleData(obj) {
        let page = Client.getPageById(obj['pageid'])
        if (!page)
            return

        let data_grid = []

        for (let j = 0; j < obj["data"].length; j++) {
            let row_grid = {}

            for (let i = 0; i < page.layout['schema'].length; i++) {
                let codename = page.layout['schema'][i]['codename']
                let hasFormat = page.layout['schema'][i]['hasFormat']

                let value = obj["data"][j][i]
                let fValue = obj["fdata"][j][i]
                if (!hasFormat) fValue = value

                if (j == 0) {
                    let ctls = page.findItemsByProperty('bindTo', codename)
  
                    for (let i in ctls) {
                        if (!ctls[i].setValue)
                            continue

                        if (ctls[i].valueIsRaw) {
                            ctls[i].xValue = value
                            ctls[i].setValue(value)
                        } else {
                            ctls[i].xValue = fValue
                            ctls[i].setValue(fValue)
                        }
                    }
                }                              

                row_grid[codename] = {
                    'value': value,
                    'fValue': fValue
                }
            }

            data_grid.push(row_grid)
        }

        let grids = page.findItemsByProperty('classType', 'ControlGrid')
        for (let i in grids)
            if (obj['action'] == 'datarow')
                grids[i].loadRow(obj, data_grid)
            else
                grids[i].loadData(obj, data_grid)
    }
}