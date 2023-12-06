/*
 *  >>> CLIENT STATUS
 *
 */

var boundary = ''
for (var i = 0; i < 230; i++)
    boundary += 'd4015c7b-152e-492e-8e8b-2021248db290'
boundary += '",'

var client_status = {
    'pages': [],
    'dataset': null,
    'modals': [],
    'last_focus': null
}

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
        .replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0,
                v = c == 'x' ? r : (r & 0x3 | 0x8)
            return v.toString(16)
        })
}

var session_id = uuidv4()

/*
 *  >>> NETWORK
 *
 */

function rpc_post(request, callback) {
    var start = 0
    var resobj = null

    debug_log(">> " + JSON.stringify(request))

    $.ajax({
        url: '/rpc',
        headers: {
            'X-Rpc-WebClient': '1',
            'X-Rpc-SessionId': session_id
        },
        type: 'post',
        contentType: 'application/json',
        data: JSON.stringify(request),
        xhr: function () {
            var xhr = $.ajaxSettings.xhr()
            xhr.onreadystatechange = function () {
                if (xhr.readyState >= 3) {
                    while (true) {
                        var p = xhr.response.indexOf(boundary, start)
                        if (p == -1)
                            break

                        var end = p + boundary.length

                        var r = handle_chunk(xhr.response.substring(start, end))
                        if (r)
                            resobj = r

                        start = end
                    }
                }
                if (xhr.readyState == 4) {
                    var r = handle_chunk(xhr.response.substring(start))
                    if (r)
                        resobj = r
                }
                if ((xhr.readyState == 4) && (callback != null))
                    callback(resobj)
            }
            return xhr
        },
        error: function (jqXHR, textStatus, errorThrown) {
            if ((!jqXHR.responseJSON) && (jqXHR.status != 200)) {
                obj = {}
                obj['message'] = 'Network error: try again later.'
                obj['trace'] = []
                show_error(obj)
            }
        }
    })
}

function handle_chunk(response) {
    var resobj = null

    if (!response.startsWith('['))
        response = '[' + response

    if (response.endsWith(','))
        response += 'null]'
    else if (!response.endsWith(']'))
        response += ']'

    objs = JSON.parse(response)
    for (var i = 0; i < objs.length; i++) {
        obj = objs[i]
        if (!obj)
            continue
        if ((typeof obj) != 'object')
            continue

        debug_log("<< " + JSON.stringify(obj))

        if (obj['type'] == 'response')
            resobj = obj
        else
            dispatch_chunk(obj)
    }

    return resobj
}

function dispatch_chunk(obj) {
    if (obj['type'] == 'exception') {
        show_error(obj)
        return
    }

    if (obj['type'] == 'send') {
        if (obj['action'] == 'closepage') {
            close_page(obj['pageid'])
            return
        }

        if ((obj['action'] == 'dataset') || (obj['action'] == 'datarow')) {
            handle_data(obj)
            return
        }

        if (obj['action'] == 'page') {
            run_page(obj)
            return
        }

        if (obj['action'] == 'property') {
            handle_properties(obj['value'])
            return
        }

        if (obj['action'] == 'reload') {
            location.reload();
            return
        }
    }
}

/*
 *  >>> PROPERTIES
 *
 */

function handle_properties(obj) {
    if (obj['property'] == 'caption') {
        document.title = obj['value']
        $('.content-wrapper').find('.content-header').find('[title-id="' + obj['pageid'] + '"]').html(obj['value'])
    }
}

/*
 *  >>> PAGE DATA
 *
 */

function get_schema_field(page, codename) {
    for (var n in page['schema'])
        if (page['schema'][n]['codename'] == codename)
            return page['schema'][n];
    return null;
}

function handle_data(obj) {
    var page = get_pagebyid(obj['pageid'])
    if (!page)
        return

    var dom = $('#' + obj['pageid'])
    if (dom.length == 0) {
        if (obj["action"] == 'dataset')
            client_status['dataset'] = obj;
        return
    }

    if (obj["action"] == 'dataset')
        client_status['dataset'] = null;    // data received before loading

    var data_grid = []

    for (var j = 0; j < obj["data"].length; j++) {
        var row_grid = {}

        for (var i = 0; i < page['schema'].length; i++) {
            var codename = page['schema'][i]['codename']
            var fieldType = page['schema'][i]['fieldType']
            var hasFormat = page['schema'][i]['hasformat']
            var value = obj["data"][j][i]
            var fValue = obj["fdata"][j][i]
            if (!hasFormat) fValue = value

            if (j == 0) {
                var ctl = dom.find('[bind-codename="' + codename + '"]')
                var tag = ctl.prop("tagName").toUpperCase()

                if ((tag == 'INPUT') && (fieldType == 'BOOLEAN')) {
                    ctl.prop('checked', value)
                    ctl.prop('x-value', value)

                } else if (tag == 'SELECT') {
                    ctl.val(value)
                    ctl.prop('x-value', value)

                } else {
                    ctl.val(fValue)
                    ctl.prop('x-value', fValue)
                }
            }

            row_grid[codename] = value
        }

        data_grid.push(row_grid)
    }

    if (obj["action"] == 'dataset') {
        dom.find('[is-grid="1"]').each(function (i, e) {
            if ($(e).attr('page-id') == obj['pageid']) {
                var g = $(e).find('#grid')
                if (g.length > 0) {
                    g.jsGrid({ data: data_grid })

                    if (obj['offset'] == 0)
                        toggle_repeater_pagination($(e), obj['count'], obj['page'])
                }
            }
        })

    } else if (obj['selectedrow'] > -1) {
        dom.find('[is-grid="1"]').each(function (i, e) {
            if ($(e).attr('page-id') == obj['pageid']) {
                var g = $(e).find('#grid')
                if (g.length > 0) {
                    var data = g.jsGrid('option', 'data')
                    data[obj['selectedrow']] = data_grid[0]
                    g.jsGrid({ data: data })
                }
            }
        })

    }
}

/*
 *  >>> PAGE RENDERER
 *
 */

function is_shortcut(evt) {
    if (evt.ctrlKey) return true
    if (evt.altKey) return true
    if ((evt.code >= "F1") && (evt.code <= "F12")) return true
    if (evt.code == "Enter") return true
    if (evt.code == "Escape") return true
    return false
}

function handle_shortcut(evt) {
    if (client_status['modals'].length > 0) {
        if (evt.code == 'Escape') {
            client_status['modals'][client_status['modals'].length - 1].modal('hide')
            evt.preventDefault()
            return false
        }
        return;
    }

    if (client_status['pages'].length == 0) return

    var page = client_status['pages'][client_status['pages'].length - 1]

    if (evt.ctrlKey || evt.altKey || is_shortcut(evt)) {
        for (var k in page["shortcuts"]) {
            if (evt.ctrlKey && (k.indexOf("Ctrl+") == -1)) continue
            if (evt.altKey && (k.indexOf("Alt+") == -1)) continue
            if (evt.shiftKey && (k.indexOf("Shift+") == -1)) continue
            if (k.indexOf(evt.code) == -1) continue

            var c = $('[control-id="' + page["shortcuts"][k] + '"]').first()
            if (c.length > 0) {
                action_trigger(c)
                evt.preventDefault()
                return false
            }
        }
    }
}

function get_pageindexbyid(pageid) {
    for (var k = 0; k < client_status['pages'].length; k++) {
        if (client_status['pages'][k]['id'] == pageid)
            return k
    }
    return -1
}

function get_pagebyid(pageid) {
    for (var k = 0; k < client_status['pages'].length; k++) {
        if (client_status['pages'][k]['id'] == pageid)
            return client_status['pages'][k]
    }
    return null
}

function pop_page(pageid) {
    var i = get_pageindexbyid(pageid)
    if (i > -1) {
        client_status['pages'].splice(i, 1)
        var n = ''
        if (client_status['pages'].length > 0)
            n = client_status['pages'][client_status['pages'].length - 1]['caption']
        document.title = n
    }
}

function call_close_page(pageid) {
    rpc_post({
        'type': 'request',
        'objectid': pageid,
        'method': 'QueryClose',
        'arguments': {
        }
    })
}

function close_page(pageid) {
    var p = $('#' + pageid)
    if (p.length > 0) {
        if (p.prop('is-modal'))
            p.modal('hide')

        else if (p.prop('is-content')) {
            p.remove()

            // remove menu
            var mnu = $("#menu-left")
            mnu.children().each(function (i, e) {
                if ($(e).attr('page-id') == pageid)
                    $(e).remove()
            })

            // restore title
            var title = $('.content-wrapper').find('.content-header').find('#title')
            title.children().each(function (i, e) {
                if ($(e).attr('page-id') == pageid) {
                    if ($(e).prev().prop('is-separator'))
                        $(e).prev().remove()
                    if ($(e).prev().prop('is-link')) {
                        var st = $(`<span>`)
                        st.html($(e).prev().html())
                        st.attr('page-id', $(e).prev().attr('page-id'))
                        st.attr('title-id', $(e).prev().prop('title-id'))
                        $(e).prev().remove()
                        $(e).before(st)
                    }
                    if ($(e).prev().attr('page-id')) {
                        var ppid = $(e).prev().attr('page-id')
                        $('#' + ppid).show()
                        mnu.children().each(function (i, e) {
                            if ($(e).attr('page-id') == ppid)
                                $(e).show()
                        })
                    }
                    $(e).remove()
                }
                if ($(e).prop('page-ids')) {
                    var i = $(e).prop('page-ids').indexOf(pageid)
                    if (i > -1)
                        $(e).prop('page-ids').splice(i, 1)
                }


            })
        }
    }

    pop_page(pageid)
}

function run_page(obj) {
    client_status['pages'].push(obj)

    document.title = obj['caption']

    var render = function () {
        $('#sideTitle').html(obj['applicationName'])

        if (obj['display'] == 'content') {
            render_controls_content(obj)

        } else if (obj['display'] == 'modal') {
            render_controls_modal(obj)

        }

        if (client_status['dataset'])
            handle_data(client_status['dataset'])

        $('input').first().trigger('focus')
    }

    if ($('body').prop('pageType') == '') {
        if (obj['pageType'] == "Normal")
            load_page(render);
        else if (obj['pageType'] == "Start")
            load_start(render);
        else if (obj['pageType'] == "Login")
            load_login(render);
    } else {
        render();
    }
}

function render_controls_modal(page) {
    var div = $(`
    <div class="modal fade" data-backdrop="static">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h4 class="modal-title" id='title'></h4>
                    <button type="button" class="close" id="close">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
    `)

    if (page['unitType'] == "Brayns.System.Confirm")
        div.find('.modal-dialog').addClass('modal-lg')
    else
        div.find('.modal-dialog').addClass('modal-xl')

    div.attr('id', page['id'])
    div.prop('is-modal', true)
    div.find('#title').html(page['caption'])
    div.appendTo('body')

    for (var c in page['controls']) {
        var ctl = page['controls'][c]

        if (ctl['controlType'] == 'ActionArea')
            render_actionarea_modal(ctl, div, page)
        else if (ctl['controlType'] == 'ContentArea')
            render_contentarea_modal(ctl, div, page)
    }

    var close = div.find('#close')
    close.attr('page-id', page['id'])
    close.on('click', function (e) {
        var a = recurse_parent($(e.target), 'page-id')
        call_close_page(a.attr('page-id'))
    })

    div.on('hidden.bs.modal', function (e) {
        $(e.target).remove()
    })

    div.modal('show')
}

function render_controls_content(page) {
    // hide menu
    var mnu = $("#menu-left")
    mnu.children().each(function (i, e) {
        if ($(e).attr('page-id'))
            $(e).hide()
    })

    // hide content
    var wrap = $('.content-wrapper')
    var title = wrap.find('.content-header').find('#title')

    if (title.children().length > 0) {
        var st = title.children(':last-child')

        var a = $(`<a href="javascript:;"></a>`)
        a.html(st.html())
        a.prop('is-link', true)
        a.prop('page-ids', [])
        a.attr('page-id', st.attr('page-id'))
        a.attr('title-id', st.prop('title-id'))
        a.on('click', function (e) {
            var pids = $(e.target).prop('page-ids')
            for (var i = 0; i < pids.length; i++)
                call_close_page(pids[i])
        })
        a.appendTo(title)

        var span = $(`<span> &gt; </span>`)
        span.prop('is-separator', true)
        span.appendTo(title)

        st.remove()

        title.children().each(function (i, e) {
            if ($(e).prop('page-ids'))
                $(e).prop('page-ids').push(page['id'])
        })
    }

    var th = $(`<span></span>`)
    th.html(page['caption'])
    th.attr('page-id', page['id'])
    th.attr('title-id', page['id'])
    th.appendTo(title)

    var fluid = wrap.find('#container')

    fluid.children().each(function (i, e) {
        $(e).hide()
    })

    // recurse controls
    for (var c in page['controls']) {
        var ctl = page['controls'][c]

        if (ctl['controlType'] == 'AppCenter')
            render_appcenter(ctl, page)

        else if (ctl['controlType'] == 'ActionArea')
            render_actionarea_content(ctl, page)

        else if (ctl['controlType'] == 'ContentArea')
            render_contentarea_content(ctl, page)

    }
}

/*
 *  >>> CONTENT
 *
 */

function render_contentarea_content(ctl, page) {
    var container = $('#container')

    var carea = $(`
        <div class="row">
            <div id="left-content">
            </div>
            <div id="right-content">
            </div>
        </div>
    `)

    carea.prop('is-content', true)
    carea.attr('id', page['id'])
    carea.find('#left-content').addClass('col-12')
    container.append(carea)

    var left = carea.find('#left-content')

    render_contentarea_controls(ctl, left, page)
}

function render_contentarea_controls(ctl, parent, page) {

    for (var c in ctl['controls']) {
        var ctl2 = ctl['controls'][c]

        if (ctl2['controlType'] == 'Group')
            render_group_parent(ctl2, parent, page)
        else if (ctl2['controlType'] == 'Repeater')
            render_repeater_parent(ctl2, parent, page)
        else if (ctl2['controlType'] == 'Text')
            render_text_parent(ctl2, parent, page)
    }

}

/*
 *  >>> APP CENTER AND RELATED
 *
 */

function render_appcenter(ctl, page) {
    $('#sidemenu').empty()
    $('body').addClass('sidebar-collapse')
    $('#menu-left').empty()

    for (var c in ctl['controls']) {
        var ctl2 = ctl['controls'][c]

        if (ctl2['controlType'] == 'Indicator')
            render_indicator(ctl2)

        else if (ctl2['controlType'] == 'NavigationPane')
            render_navigationpane(ctl2, page)

        else if (ctl2['controlType'] == 'Notification')
            render_notification(ctl2, page)

        else if (ctl2['controlType'] == 'Search')
            render_search(ctl2, page)

        else if (ctl2['controlType'] == 'UserCenter')
            render_usercenter(ctl2, page)

        else if (ctl2['controlType'] == 'Footer')
            render_footer(l2, page)
    }

    $('body').Layout('init')
    $('[data-widget="treeview"]').Treeview('init')
}

function render_footer(ctl) {
    var wrap = $(".wrapper")
    var foot = $(`<footer class="main-footer"></footer>`)
    foot.appendTo(wrap);
    foot.html(ctl['caption'])
}

function render_indicator(ctl) {
    var capt = ctl['caption']
    if (capt == '')
        return

    var li = $(`
        <li class="nav-item" id="indicator">
            <span class="badge badge-info"></span>
        </li>
    `)
    li.css('padding-top', '4px')
    li.css('padding-left', '16px')
    li.css('padding-right', '16px')
    li.find('.badge').html(capt)
    $('#menu-right').append(li)
}

function render_search(ctl, page) {
    var li = $(`
    <li class="nav-item">
        <a class="nav-link" data-widget="navbar-search" href="javascript:;" role="button">
            <i class="fas fa-search"></i>
        </a>
        <div class="navbar-search-block">
            <form class="form-inline">
                <div class="input-group input-group-sm">
                    <input class="form-control form-control-navbar" type="search" id='search' placeholder=""
                           aria-label="Search">
                    <div class="input-group-append">
                        <button class="btn btn-navbar" type="submit">
                            <i class="fas fa-search"></i>
                        </button>
                        <button class="btn btn-navbar" type="button" data-widget="navbar-search">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            </form>
        </div>
    </li>
    `)

    li.find('#search').attr('placeholder', ctl['caption'])
    $('#menu-right').append(li)
}

function render_notification(ctl, page) {
    var li = $(`
        <li class="nav-item dropdown" id="ctlNotification">
            <a class="nav-link" data-toggle="dropdown" href="javascript:;">
                <i class="fas fa-bell"></i>
                <span class="badge badge-danger navbar-badge" id='badge'></span>
            </a>
        </li>
    `)
    li.prop('has-actions', false)
    li.attr('control-id', ctl['id'])
    li.attr('page-id', page['id'])
    $('#menu-right').append(li)

    for (var c in ctl['controls']) {
        var ctl2 = ctl['controls'][c]

        if (ctl2['controlType'] == 'Action')
            render_action_notification(ctl2, ctl, page)
    }

    //TODOsetTimeout(refresh_notifications, 1000);
}

function refresh_notifications() {
    var li = $('#ctlNotification')

    rpc_post({
        'type': 'request',
        'objectid': li.attr('page-id'),
        'method': 'ControlInvoke',
        'arguments': {
            'controlid': li.attr('control-id'),
            'method': 'get_notifications'
        }
    }, function (e) {
        if (!e)
            return

        var todel = []
        var div = li.find('.dropdown-menu')
        div.children().each(function (i, e) {
            if ($(e).prop('is-notification'))
                todel.push($(e))
        })
        for (var i = 0; i < todel.length; i++)
            todel[i].remove()

        if (e['value'].length == 0) {
            li.find('#badge').html('')
            div.remove()

        } else {
            li.find('#badge').html(e['value'].length)

            if (div.length == 0) {
                div = $(`
                    <div class="dropdown-menu dropdown-menu-lg dropdown-menu-right">
                    </div>
                `)
                div.appendTo(li)
            }

            for (var i = 0; i < e['value'].length; i++) {
                var msg = $(`
                    <a href="javascript:;" class="dropdown-item">
                        <div class="media">
                            <div class="media-body">
                                <h3 class="dropdown-item-title">
                                    <span id='title'></span>
                                    <span class="float-right text-sm text-muted"><i id='icon'></i></span>
                                </h3>
                                <p class="text-sm" id='description'></p>
                                <p class="text-sm text-muted"><i class="far fa-clock mr-1"></i><span id='age'></span></p>
                            </div>
                        </div>
                    </a>
                `)
                msg.find('#title').html(e['value'][i]['title'])
                msg.find('#description').html(e['value'][i]['description'])
                msg.find('#icon').addClass(e['value'][i]['icon'])
                msg.find('#age').html(e['value'][i]['age'])
                msg.prop('is-notification', true)
                div.prepend(msg)

                var dro = $(`<div class="dropdown-divider"></div>`)
                dro.prop('is-notification', true)
                div.prepend(dro)
            }
        }

        setTimeout(refresh_notifications, 10000);
    })
}

function render_usercenter(ctl, page) {
    var li = $(`
        <li class="nav-item dropdown">
            <a class="nav-link" data-toggle="dropdown" href="javascript:;">
                <i class="fas fa-cog"></i>
            </a>
            <div class="dropdown-menu dropdown-menu-lg dropdown-menu-right">
                <span class="dropdown-item dropdown-header" id="title"></span>
            </div>
        </li>
    `)
    li.find('#title').html(ctl['caption'])
    li.prop('id', ctl['id'])
    $('#menu-right').append(li)

    for (var c in ctl['controls']) {
        var ctl2 = ctl['controls'][c]

        if (ctl2['controlType'] == 'Action')
            render_action_usercenter(ctl2, ctl, page)
    }
}

function render_navigationpane(ctl, page) {
    $('body').removeClass('sidebar-collapse')

    var li = $(`
        <li class="nav-item" id="pushmenu">
            <a class="nav-link" data-widget="pushmenu" href="javascript:;" role="button"><i class="fas fa-bars"></i></a>
        </li>
    `)
    $('#menu-left').append(li)

    for (var c in ctl['controls']) {
        var ctl2 = ctl['controls'][c]

        if (ctl2['controlType'] == 'Action')
            render_action_navigationpane(ctl2, page)
        else if (ctl2['controlType'] == 'ActionGroup')
            render_actiongroup_navigationpane(ctl2, page)
    }
}

/*
 *  >>> ACTIONS INSIDE USER CENTER
 *
 */

function render_action_usercenter(ctl, parent, page) {
    var menu = $('#' + parent['id']).find('.dropdown-menu')
    menu.append(`
        <div class="dropdown-divider"></div>
    `)

    var act = $(`
        <a href="javascript:;" class="dropdown-item">
            <i id="icon"></i><span id="title"></span>
        </a>
    `)
    if (ctl['icon'] > '') {
        act.find('#icon').addClass(ctl['icon'])
        act.find('#icon').addClass('mr-2')
    }
    act.find('#title').html(ctl['caption'])

    act.attr('control-id', ctl['id'])
    act.attr('page-id', page['id'])
    act.on('click', function (e) {
        var a = recurse_parent($(e.target), 'control-id')
        action_trigger(a)
    })
    menu.append(act)
}

/*
 *  >>> ACTIONS INSIDE NOTIFICATION
 *
 */

function render_action_notification(ctl, parent, page) {
    var li = $('#ctlNotification')
    var div = li.find('.dropdown-menu')
    if (div.length == 0) {
        div = $(`
            <div class="dropdown-menu dropdown-menu-lg dropdown-menu-right">
            </div>
        `)
        div.appendTo(li)
    }

    var act = $(`
        <div class="dropdown-divider"></div>
        <a href="javascript:;" class="dropdown-item">
            <i id="icon"></i><span id="title"></span>
        </a>
    `)
    if (ctl['icon'] > '') {
        act.find('#icon').addClass(ctl['icon'])
        act.find('#icon').addClass('mr-2')
    }
    act.find('#title').html(ctl['caption'])

    act.attr('control-id', ctl['id'])
    act.attr('page-id', page['id'])
    act.on('click', function (e) {
        var a = recurse_parent($(e.target), 'control-id')
        action_trigger(a)
    })
    div.append(act)
}

/*
 *  >>> MODALS
 *
 */

function render_contentarea_modal(ctl, parent, page) {
    var hdr = parent.find('.modal-header')
    var div = $(`<div class="modal-body"></div>`)
    hdr.after(div)

    render_contentarea_controls(ctl, div, page)
}

function render_actionarea_modal(ctl, parent, page) {
    var cnt = parent.find('.modal-content')
    var div = $(`<div class="modal-footer"></div>`)
    cnt.append(div)

    for (var c in ctl['controls']) {
        var ctl2 = ctl['controls'][c]

        if (ctl2['controlType'] == 'Action')
            render_button_parent(ctl2, div, page)
    }
}

/*
 *  >>> CONTROLS IN PARENT
 *
 */

function toggle_repeater_pagination(ctl, count, page) {
    var pages = Math.ceil(count / page)

    if (pages == 1) {
        ctl.find('#page-f').remove()
        ctl.find('#page-p').remove()
        ctl.find('#page-l').remove()

    } else {
        var sg = ctl.find('#search-grp')

        if (ctl.find('#page-l').length == 0) {
            var pl = $(`
                <div style="display: inline-block" id="page-l">
                    <ul class="pagination pagination-sm">
                        <li class="page-item"><a href="javascript:;" class="page-link" id="golast">»</a></li>
                    </ul>
                </div>
            `)

            var al = pl.find('#golast')
            al.attr('page-id', ctl.attr('page-id'))
            al.prop('page-size', page)
            al.prop('page-no', pages - 1)
            al.on('click', function (e) {
                rpc_post({
                    'type': 'request',
                    'objectid': $(e.target).attr('page-id'),
                    'method': '_getdata',
                    'arguments': {
                        'offset': $(e.target).prop('page-no') * $(e.target).prop('page-size'),
                        'limit': $(e.target).prop('page-size')
                    }
                }, function (r) {
                    if (r) {
                        var grid = recurse_parent($(e.target), 'control-id')
                        var sl = grid.find('#page-p').find('select')
                        sl.val($(e.target).prop('page-no'))
                    }
                })
            })
            sg.after(pl)
        }

        if (ctl.find('#page-p').length == 0) {
            var pp = $(`
                <div style="display: inline-block" id="page-p">
                    <select class="form-control form-control-sm" id="pagination">
                    </select>
                </div>
            `)

            var sl = pp.find('select')
            for (var i = 1; i < pages; i++) {
                var opt = $('<option>' + i + '</option>')
                sl.append(opt)
            }
            sl.attr('page-id', ctl.attr('page-id'))
            sl.prop('page-size', page)
            sl.on('change', function (e) {
                rpc_post({
                    'type': 'request',
                    'objectid': $(e.target).attr('page-id'),
                    'method': '_getdata',
                    'arguments': {
                        'offset': ($(e.target).val() - 1) * $(e.target).prop('page-size'),
                        'limit': $(e.target).prop('page-size')
                    }
                })
            })

            sg.after(pp)
        }

        if (ctl.find('#page-f').length == 0) {
            var pf = $(`
                <div style="display: inline-block" id="page-f">
                    <ul class="pagination pagination-sm">
                        <li class="page-item"><a href="javascript:;" class="page-link" id="gofirst">«</a></li>
                    </ul>
                </div>
            `)

            var af = pf.find('#gofirst')
            af.attr('page-id', ctl.attr('page-id'))
            af.prop('page-size', page)
            af.on('click', function (e) {
                rpc_post({
                    'type': 'request',
                    'objectid': $(e.target).attr('page-id'),
                    'method': '_getdata',
                    'arguments': {
                        'offset': 0,
                        'limit': $(e.target).prop('page-size')
                    }
                }, function (r) {
                    if (r) {
                        var grid = recurse_parent($(e.target), 'control-id')
                        var sl = grid.find('#page-p').find('select')
                        sl.val(1)
                    }
                })
            })
            sg.after(pf)
        }
    }
}

function render_repeater_parent(ctl, parent, page) {
    var grp = $(`
        <div class="card card-light">
            <div class="card-header">
                <h3 class="card-title"></h3>
                <div class="card-tools">
                    <div style="display: inline-block" id="search-grp">
                        <div class="input-group input-group-sm">
                            <input type="text" class="form-control float-right" id="search">
                            <div class="input-group-append">
                                <button type="submit" class="btn btn-default">
                                    <i class="fas fa-search"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                    <button type="button" class="btn btn-tool" data-card-widget="collapse">
                        <i class="fas fa-minus"></i>
                    </button>
                </div>
            </div>
            <div class="card-body">
                <div id="grid"></div>
            </div>
        </div>
    `)

    grp.attr('is-grid', '1')
    grp.attr('control-id', ctl['id'])
    grp.attr('page-id', page['id'])
    grp.appendTo(parent)
    grp.find('#search').attr('placeholder', ctl['label_search'])

    var body = grp.find('.card-body')
    body.css('padding', '4px')

    var fields = []

    for (var c in ctl['controls']) {
        var ctl2 = ctl['controls'][c]

        if (ctl2['controlType'] == 'Field') {
            var f = {
                name: ctl2['codename'],
                title: ctl2['caption']
            }
            fields.push(f)
        }
    }

    var grid = grp.find('#grid')
    grid.jsGrid({
        height: "auto",
        width: "100%",
        sorting: true,
        data: [],
        noDataContent: ctl['label_nodata'],
        fields: fields,
        sort: function (e) {
            // console.log(JSON.stringify(e))
        },
        rowClick: function (e) {
            var grp = recurse_parent($(e.event.target), 'page-id')
            rpc_post({
                'type': 'request',
                'objectid': grp.attr('page-id'),
                'method': '_selectrows',
                'arguments': {
                    'rows': [e.itemIndex]
                }
            })
        },
        rowDoubleClick: function (e) {
            var grp = recurse_parent($(e.event.target), 'control-id')
            rpc_post({
                'type': 'request',
                'objectid': grp.attr('page-id'),
                'method': 'ControlInvoke',
                'arguments': {
                    'controlid': grp.attr('control-id'),
                    'method': 'dblclick'
                }
            })
        }
    })
}

function render_group_parent(ctl, parent, page) {
    var grp = $(`
        <div class="card">
            <div class="card-header">
                <h3 class="card-title"></h3>
            </div>
            <div class="card-body">
            </div>
        </div>
    `)

    if (ctl['primary'])
        grp.addClass('card-primary')
    else
        grp.addClass('card-light')

    if (ctl['collapsible']) {
        var tools = $(`
            <div class="card-tools">
                <button type="button" class="btn btn-tool" data-card-widget="collapse">
                    <i class="fas fa-minus"></i>
                </button>
            </div>
        `)
        grp.find('.card-header').append(tools)
    }

    grp.appendTo(parent)
    grp.find('.card-title').html(ctl['caption'])
    var body = grp.find('.card-body')

    var actions = []

    for (var c in ctl['controls']) {
        var ctl2 = ctl['controls'][c]

        if (ctl2['controlType'] == 'Field')
            render_field_parent(ctl2, body, page, ctl)
        else if (ctl2['controlType'] == 'Action')
            actions.push(ctl2)
    }

    if (actions.length > 0) {
        var foot = $(`<div class="card-footer">`)
        foot.appendTo(grp)

        for (var c in actions)
            render_button_parent(actions[c], foot, page)
    }
}

function render_checkbox(ctl, parent, page, schema) {
    var grp = $(`<div class="form-check">`)

    var inp = $(`<input type="checkbox" class="form-check-input">`)
    inp.appendTo(grp)
    inp.attr('bind-codename', ctl['codename'])
    inp.prop('ctl-type', ctl['controlType'])
    inp.attr('control-id', ctl['id'])
    inp.attr('page-id', page['id'])
    inp.attr('id', ctl['id'])

    inp.on('change', function (e) {
        if ($(e.target).prop('x-value') === $(e.target).prop('checked'))
            return

        rpc_post({
            'type': 'request',
            'objectid': $(e.target).attr('page-id'),
            'method': 'ControlInvoke',
            'arguments': {
                'controlid': $(e.target).attr('control-id'),
                'method': 'Validate',
                'args': {
                    'value': $(e.target).prop('checked'),
                    'parseValue': false
                }
            }
        }, function (r) {
            if (!r)
                $(e.target).prop('checked', $(e.target).prop('x-value'))
        })
    })

    var lab = $(`<label class="form-check-label">`)
    lab.attr('for', ctl['id'])
    lab.html(ctl['caption'])
    lab.appendTo(grp)

    grp.appendTo(parent)
}

function render_select(ctl, parent, page, schema) {
    var sel = $(`<select class="custom-select-sm form-control">`)

    for (var i in schema['options']) {
        var opt = $(`<option>`)
        opt.attr('value', schema['options'][i]['value'])
        opt.html(schema['options'][i]['caption'])
        opt.appendTo(sel)
    }

    sel.attr('bind-codename', ctl['codename'])
    sel.prop('ctl-type', ctl['controlType'])
    sel.attr('control-id', ctl['id'])
    sel.attr('page-id', page['id'])
    sel.attr('id', ctl['id'])

    sel.on('change', function (e) {
        if ($(e.target).prop('x-value') === $(e.target).val())
            return

        rpc_post({
            'type': 'request',
            'objectid': $(e.target).attr('page-id'),
            'method': 'ControlInvoke',
            'arguments': {
                'controlid': $(e.target).attr('control-id'),
                'method': 'Validate',
                'args': {
                    'value': $(e.target).val(),
                    'parseValue': true
                }
            }
        }, function (r) {
            if (!r)
                $(e.target).val($(e.target).prop('x-value'))
        })
    })

    sel.appendTo(parent)
}

function render_input(ctl, parent, page, schema) {
    var inp = $(`<input class="form-control form-control-sm">`)

    if (ctl['inputType'] == 'Password')
        inp.attr('type', 'password')

    inp.attr('bind-codename', ctl['codename'])
    inp.prop('ctl-type', ctl['controlType'])
    inp.attr('control-id', ctl['id'])
    inp.attr('id', ctl['id'])
    inp.attr('page-id', page['id'])
    inp.on('focus', function (e) {
        client_status['last_focus'] = $(e.target)
    })
    inp.on('blur', function (e) {
        if ($(e.target).prop('x-value') === $(e.target).val())
            return

        rpc_post({
            'type': 'request',
            'objectid': $(e.target).attr('page-id'),
            'method': 'ControlInvoke',
            'arguments': {
                'controlid': $(e.target).attr('control-id'),
                'method': 'Validate',
                'args': {
                    'value': $(e.target).val(),
                    'parseValue': true
                }
            }
        }, function (r) {
            if (!r)
                $(e.target).val($(e.target).prop('x-value'))
        })
    })

    inp.appendTo(parent)
}

function render_field_parent(ctl, parent, page, ctlParent) {
    var schema = get_schema_field(page, ctl['codename'])

    var newRow = true
   
    var row = parent.children(':last-child')
    if ((row.length > 0) && (ctlParent['labelOrientation'] == 'Horizontal') && (ctlParent['fieldPerRow'] == 'Two')) {
        if (row.prop('ctl-count') == 1) {
            newRow = false
        }
    }
   
    if (newRow) {
        row = $(`<div>`)
        row.addClass("row")
        row.appendTo(parent)
        row.prop('ctl-count', 1)
    } else {
        row.prop('ctl-count', 2)
    }

    var grp = $('<div class="form-group">')

    if (ctlParent['labelOrientation'] == 'Horizontal')
        grp.addClass("row")
    if (ctlParent['fieldPerRow'] == 'One')
        grp.addClass("col-sm-12")
    else
        grp.addClass("col-sm-6")
    grp.appendTo(row)
    
    var hasLabel = true
    if (schema["fieldType"] == "BOOLEAN")
        hasLabel = false

    if (hasLabel) {
        var label = $(`<label class="col-form-label font-weight-normal" style="padding-top: 0px"></label>`)
        label.attr('for', ctl['id'])
        if (ctlParent['labelOrientation'] == 'Horizontal')
            label.addClass('col-sm-4')
        else
            label.addClass('col-sm-12')
        label.html(ctl['caption'] + ':')
        label.appendTo(grp)
    }

    var field = $(`<div />`)
    if ((ctlParent['labelOrientation'] == 'Horizontal') && hasLabel)
        field.addClass('col-sm-8')
    else
        field.addClass('col-sm-12')

    if (schema["fieldType"] == "OPTION")
        render_select(ctl, field, page, schema)
    else if (schema["fieldType"] == "BOOLEAN")
        render_checkbox(ctl, field, page, schema)
    else
        render_input(ctl, field, page, schema)

    field.appendTo(grp)
}

function render_text_parent(ctl, parent, page) {
    var div = $(`<div></div>`)
    div.attr('bind-codename', ctl['codename'])
    div.prop('ctl-type', ctl['controlType'])
    parent.append(div)
}

function render_button_parent(ctl, parent, page) {
    var bnt = $(`
        <div class="btn-group">
            <button type="button" class="btn btn-default"></button>
        </div>
    `)
    bnt.find('button').html(ctl['caption'])
    bnt.attr('control-id', ctl['id'])
    bnt.attr('page-id', page['id'])

    if (parent.hasClass('card-footer'))
        bnt.addClass('float-right')

    parent.append(bnt)

    bnt.on('click', function (e) {
        var a = recurse_parent($(e.target), 'control-id')
        action_trigger(a)
    })

    for (var c in ctl['controls']) {
        var ctl2 = ctl['controls'][c]

        if (ctl2['controlType'] == 'Action')
            render_button_button(ctl2, bnt, page)
    }
}

function render_button_button(ctl, parent, page) {
    var btnpar = parent.children('button')
    btnpar.addClass('dropdown-toggle')
    btnpar.attr('data-toggle', 'dropdown')

    parent.off('click')

    var div = parent.children('.dropdown-menu')
    if (div.length == 0) {
        div = $(`<div class="dropdown-menu"></div>`)
        parent.append(div)
    }

    var a = $(`<a class="dropdown-item" href="javascript:;"></a>`)
    a.html(ctl['caption'])
    a.attr('control-id', ctl['id'])
    a.attr('page-id', page['id'])
    a.appendTo(div)

    a.on('click', function (e) {
        var a = recurse_parent($(e.target), 'control-id')
        action_trigger(a)
    })
}

/*
 *  >>> ACTIONS IN CONTENT MODE
 *
 */

function render_actionarea_content(ctl, page) {
    for (var c in ctl['controls']) {
        var ctl2 = ctl['controls'][c]

        if (ctl2['controlType'] == 'Action')
            render_action_actionarea_content(ctl2, page)
    }
}

function render_action_actionarea_content(ctl, page) {
    var li = $(`
        <li class="nav-item">
            <a href="javascript:;" class="nav-link">
                <i></i>
                <span id="caption"></span>
            </a>
        </li>
    `)
    li.find('i').addClass(ctl['icon'])
    li.find('#caption').html(ctl['caption'])
    li.prop('id', ctl['id'])
    li.prop('menu-level', 0)
    li.attr('control-id', ctl['id'])
    li.attr('page-id', page['id'])
    li.on('click', function (e) {
        var a = recurse_parent($(e.target), 'control-id')
        action_trigger(a)
    })

    var mnu = $("#menu-left")
    mnu.append(li)

    for (var c in ctl['controls']) {
        var ctl2 = ctl['controls'][c]

        if (ctl2['controlType'] == 'Action')
            render_action_action_content(ctl2, ctl, page)
    }
}

function render_action_action_content(ctl, parent, page) {
    var par = $('#' + parent['id'])
    par.off('click')
    var level = par.prop('menu-level') * 1 + 1

    var a = par.children('a')
    a.attr('data-toggle', 'dropdown')
    a.attr('aria-expanded', false)
    a.attr('aria-haspopup', true)
    a.addClass('dropdown-toggle')

    var ul = par.children('ul')
    if (ul.length == 0) {
        ul = $(`<ul class="dropdown-menu border-0 shadow"></ul>`)
        par.append(ul)
    }

    if (level == 1) {
        par.addClass('dropdown')

    } else {
        par.addClass('dropdown-submenu')
        par.addClass('dropdown-hover')
    }

    var li = $(`
        <li>
            <a href="javascript:;" class="dropdown-item">
                <i></i>
                <span id="caption"></span>
            </a>
        </li>
    `)
    li.find('i').addClass(ctl['icon'])
    li.find('#caption').html(ctl['caption'])
    li.prop('id', ctl['id'])
    li.prop('menu-level', level)
    li.attr('control-id', ctl['id'])
    li.attr('page-id', page['id'])
    li.on('click', function (e) {
        var a = recurse_parent($(e.target), 'control-id')
        action_trigger(a)
    })
    ul.append(li)

    for (var c in ctl['controls']) {
        var ctl2 = ctl['controls'][c]

        if (ctl2['controlType'] == 'Action')
            render_action_action_content(ctl2, ctl, page)
    }
}

/*
 *  >>> ACTIONS INSIDE NAVIGATION PANE
 *
 */

function render_actiongroup_navigationpane(ctl, page) {
    var li = $(`<li class="nav-header"></li>`)
    li.html(ctl['caption'])
    $('#sidemenu').append(li)

    for (var c in ctl['controls']) {
        var ctl2 = ctl['controls'][c]

        if (ctl2['controlType'] == 'Action')
            render_action_navigationpane(ctl2, page)
    }
}

function render_action_navigationpane(ctl, page) {
    var li = $(`
        <li class="nav-item">
            <a href="javascript:;" class="nav-link">
                <i class="nav-icon"></i>
                <p>
                    <span id="caption"></span>
                </p>
            </a>
        </li>
    `)

    li.find('i').addClass(ctl['icon'])
    li.find('#caption').html(ctl['caption'])
    li.attr('control-id', ctl['id'])
    li.attr('page-id', page['id'])
    li.attr('id', ctl['id'])
    li.on('click', function (e) {
        var a = recurse_parent($(e.target), 'control-id')
        action_trigger(a)
    })
    $('#sidemenu').append(li)

    for (var c in ctl['controls']) {
        var ctl2 = ctl['controls'][c]

        if (ctl2['controlType'] == 'Action')
            render_action_action_navigationpane(ctl2, ctl, page)
    }
}

function render_action_action_navigationpane(ctl, parent, page) {
    var parent = $('#' + parent['id'])
    parent.off('click')

    var ul = parent.children('ul')
    if (ul.length == 0) {
        ul = $(`
            <ul class="nav nav-treeview">
        `)
        ul.appendTo(parent)
    }

    var p = parent.children('a').children('p')
    var img = p.children('i')
    if (img.length == 0) {
        img = $(`
            <i class="fas fa-angle-left right"></i>
        `)
        img.appendTo(p)
    }

    var li = $(`
        <li class="nav-item">
            <a href="javascript:;" class="nav-link">
                <i class="nav-icon"></i>
                <p>
                    <span id="caption"></span>
                </p>
            </a>
        </li>
    `)

    li.find('i').addClass(ctl['icon'])
    li.find('#caption').html(ctl['caption'])
    li.attr('control-id', ctl['id'])
    li.attr('page-id', page['id'])
    li.attr('id', ctl['id'])
    li.on('click', function (e) {
        var a = recurse_parent($(e.target), 'control-id')
        action_trigger(a)
    })
    li.appendTo(ul)

    for (var c in ctl['controls']) {
        var ctl2 = ctl['controls'][c]

        if (ctl2['controlType'] == 'Action')
            render_action_action_navigationpane(ctl2, ctl, page)
    }
}


/*
 *  >>> COMMON
 *
 */

function action_trigger(obj) {
    rpc_post({
        'type': 'request',
        'objectid': obj.attr('page-id'),
        'method': 'ControlInvoke',
        'arguments': {
            'controlid': obj.attr('control-id'),
            'method': 'Trigger'
        }
    })
}

/*
 *  >>> UTILITY
 *
 */

function debug_log(line) {
    if (window.location.hostname == "localhost")
        console.log(line)
}

function recurse_parent(obj, attr) {
    if (obj.attr(attr))
        return obj
    else {
        if (obj.parent().length == 0)
            return null
        else
            return recurse_parent(obj.parent(), attr)
    }
}

/*
 *  >>> ERROR MODAL
 *
 */

function show_error(obj) {
    var div = $(`
    <div class="modal fade">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h4 class="modal-title" id='title'></h4>
                    <button type="button" class="close" data-dismiss="modal">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
                <div class="modal-body">
                    <p id="message"></p>
                    <code id="stack"></code>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-primary" data-dismiss="modal" id='ok'></button>
                </div>
            </div>
        </div>
    </div>
    `)
    div.appendTo('body')
    div.find('#title').html('Error')
    div.find('#message').html(obj['message'])
    div.find('#ok').html('OK')
    div.prop('modal-id', uuidv4())

    var trace = ''
    for (var t in obj['trace'])
        trace += obj['trace'][t] + '<br/>'
    div.find('#stack').html(trace)

    div.on('hidden.bs.modal', function (e) {
        var ediv = $(e.target)
        ediv.remove()

        for (var i = 0; i < client_status['modals'].length; i++)
            if (client_status['modals'][i].prop('modal-id') == ediv.prop('modal-id')) {
                client_status['modals'].splice(i, 1)
                break;
            }

        if (client_status['last_focus'])
            client_status['last_focus'].trigger('focus')
    })

    div.modal('show')

    client_status['modals'].push(div)
}

/*
 *  >>> INITIALIZERS
 *
 */

function core_initialize() {
    $('body').prop("pageType", '')

    rpc_post({
        'type': 'request',
        'classname': 'Brayns.System.ClientManagement',
        'method': 'Initialize',
        'arguments': {}
    })

    $(window).on("beforeunload", function () {
        // todo  
        return;
        for (var i = 0; i < client_status['pages'].length; i++) {
            var pid = client_status['pages'][i]['id']
            rpc_post({
                'type': 'request',
                'objectid': pid,
                'method': '_close',
                'arguments': {
                    'mandatory': true
                }
            })
        }
    })

    $(document).on('keydown', handle_shortcut)
}

function load_page(callback) {
    $('#bodyArea').load('page.html', function (e) {
        $('body').prop('pageType', 'page')
        $('body').removeClass()
        $('body').addClass('hold-transition')
        $('body').addClass('layout-top-nav')
        $('body').addClass('text-sm')
        $('body').css('min-height', '')
        $('#indicator').css('display', 'none')

        if (callback) callback()

        $('body').Layout('init')
    })
}

function load_start(callback) {
    $('#bodyArea').load('start.html', function (e) {
        $('body').prop("pageType", 'start')
        $('body').removeClass()
        $('body').addClass('hold-transition')
        $('body').addClass('layout-fixed')
        $('body').addClass('sidebar-collapse')
        $('body').addClass('text-sm')
        $('body').css('min-height', '')
        $('#indicator').css('display', 'none')

        if (callback) callback()

        $('body').Layout('init')
    })
}

function load_login(callback) {
    $('#bodyArea').load('login.html', function (e) {
        $('body').prop('pageType', 'login')
        $('body').removeClass()
        $('body').addClass('hold-transition')
        $('body').addClass('login-page')
        $('body').addClass('text-sm')
        $('body').css('min-height', '500px')

        if (callback) callback()

        $('body').css('height', '');
        $('body').Layout('init')
    })
}



