/**
Disclaimer
This is only a sample code and is NOT guaranteed to be bug free and/or in production quality.

Please contact @author German Cheung <gecheung@cisco.com> for any questions. Thanks.

Acknowledgement:
Memory Functions by Zacharie Gignac & Robert McGonigle
*/

import xapi from 'xapi';

const MACRO_VERSION     = '0.9.221212-5';

const NUM_DISPLAY       = 2;  // 2 or 3
const VO_3_FOLLOW_2     = true;

const SHOW_PAGE_DISPLAY   = true;
const SHOW_PAGE_ADVANCED  = false;

/**********************************************************************************/
/* Constants, not suppose to change
*/
// MonitorRole = Auto/First/Second/Third/PresentationOnly/Recorder
const MONITORS_2_PRESET = {
  '1': {'output_connecters': [{'id': 1, 'MonitorRole': 'First'}, {'id': 2, 'MonitorRole': 'Second'}, {'id': 3, 'MonitorRole': 'Second'}]}, // Video on Left Display. Presentation on Right Display. 3rd Display follows Output 2
  '2': {'output_connecters': [{'id': 1, 'MonitorRole': 'Second'}, {'id': 2, 'MonitorRole': 'First'}, {'id': 3, 'MonitorRole': 'First'}]}, // Presentation on Left Display. Video on Right Display. 3rd Display follows Output 2
  '3': {'output_connecters': [{'id': 1, 'MonitorRole': 'PresentationOnly'}, {'id': 2, 'MonitorRole': 'PresentationOnly'}, {'id': 3, 'MonitorRole': 'PresentationOnly'}]}, // Presentation Only on all Display. 3rd Display follows Output 2
  '4': {'output_connecters': [{'id': 1, 'MonitorRole': 'First'}, {'id': 2, 'MonitorRole': 'First'}, {'id': 3, 'MonitorRole': 'First'}]},  // Video + Presentation on the same Display. 3rd Display follows Output 2
  '5': {'output_connecters': [{'id': 1, 'MonitorRole': 'First'}, {'id': 2, 'MonitorRole': 'Second'}, {'id': 3, 'MonitorRole': 'Second'}]}  // Advanced Settings
};

const MONITORS_3_PRESET = {
  '1': {'output_connecters': [{'id': 1, 'MonitorRole': 'First'}, {'id': 2, 'MonitorRole': 'Second'}, {'id': 3, 'MonitorRole': 'Third'}]},
  '2': {'output_connecters': [{'id': 1, 'MonitorRole': 'Second'}, {'id': 2, 'MonitorRole': 'First'}, {'id': 3, 'MonitorRole': 'Third'}]},
  '3': {'output_connecters': [{'id': 1, 'MonitorRole': 'PresentationOnly'}, {'id': 2, 'MonitorRole': 'PresentationOnly'}, {'id': 3, 'MonitorRole': 'PresentationOnly'}]},
  '4': {'output_connecters': [{'id': 1, 'MonitorRole': 'First'}, {'id': 2, 'MonitorRole': 'First'}, {'id': 3, 'MonitorRole': 'First'}]},
  '5': {'output_connecters': [{'id': 1, 'MonitorRole': 'First'}, {'id': 2, 'MonitorRole': 'Second'}, {'id': 3, 'MonitorRole': 'Third'}]}
};

const widgetIds = {
  'monitor_preset':    'group-monitor_preset',
  'monitor_role_1':    'group-monitor_role_1',
  'monitor_role_2':    'group-monitor_role_2',
  'monitor_role_3':    'group-monitor_role_3',
  'monitor_role_save': 'button-monitor_role_save',
  'page_monitor_role_preset':   'page-monitor_role_preset',
  'page_monitor_role_advanced': 'page-monitor_role_advanced',
  'vc_reset_1':        'text-vc_reset_1',
};

const PANEL_ID             = 'panel-bve_display_control';
const PANEL_BTN_NAME       = 'Display Control';
const PANEL_BTN_ICON       = 'Tv'; // Input, Tv, Proximity
const REMOVE_PANEL         = [''];

const TIMER_INIT_CONFIG    = 2 * 1000; // in msec
const TIMER_UPDATE_UI      = 1000;

const CONFIG_SAVE_TEXT     = 'Settings are saved.';
const CONFIG_SAVE_DURATION = 5;
const MONITORS_PRESET = (NUM_DISPLAY == 2)? MONITORS_2_PRESET : MONITORS_3_PRESET;
const PRESET_1 = '1';
const PRESET_4 = '4';
const PRESET_5 = '5';

const default_config = {
  'video': {
    'monitor_preset_id':  PRESET_1,
    'monitor_preset':     MONITORS_PRESET
  }
};

const DEVICE_DATA = 'device_data';
const DEVICE_DATA_C = {
  'version': '1.1',
  'reset_by_date': false,
  'video': default_config.video
}

let device_data = JSON.parse(JSON.stringify(DEVICE_DATA_C));
let device_status = {};

/**********************************************************************************/
/**/
async function VideoOutputMonitor(event, b_ui=true) {
  handleLog('VideoOutputMonitor', `b_ui=${b_ui}, event=`, event, device_data);
  if(event.WidgetId && event.Value) {
    const id = event.WidgetId.slice(-1);
    await setVideoOutputConnectorMonitorRole(id,  event.Value);
    device_data.video.monitor_preset[PRESET_5].output_connecters[id-1].MonitorRole = event.Value;

    if(VO_3_FOLLOW_2 && id == 2 && NUM_DISPLAY == 2)     await setVideoOutputConnectorMonitorRole(3,  event.Value);

    if(b_ui)  updateUI({'video': {'monitor_role': event}});
  }
}

async function VideoOutputReset(cb_from='', monitor_preset_id='', b_ui=true) {
  const monitor_preset_id_2 = (!monitor_preset_id) ? device_data.video.monitor_preset_id : monitor_preset_id;
  handleLog('VideoOutputReset', `cb_from=${cb_from}, monitor_preset_id=${monitor_preset_id}, monitor_preset_id_2=${monitor_preset_id_2}, cnt_vo_connector=${device_status.cnt_vo_connector}, b_ui=${b_ui}`);

  if(monitor_preset_id_2 && monitor_preset_id_2 != PRESET_5) {
    const setting = device_data.video.monitor_preset[monitor_preset_id_2].output_connecters;
    device_data.video.monitor_preset[PRESET_5].output_connecters = JSON.parse(JSON.stringify(setting));
  }
  handleDebug('VideoOutputReset', `PRESET_5`, device_data.video.monitor_preset[PRESET_5].output_connecters);

  const setting = device_data.video.monitor_preset[monitor_preset_id_2].output_connecters;
  for (const val of Object.values(setting)) {
    if(val.id <= device_status.cnt_vo_connector)   await setVideoOutputConnectorMonitorRole(val.id,  val.MonitorRole);
  }

  if(monitor_preset_id_2 == PRESET_4) {
    const layout = await xapi.status.get(`Video Layout CurrentLayouts AvailableLayouts`).catch(e => {return []});
    handleDebug('VideoOutputReset', `layout`, layout);
    for (const val of Object.values(layout)) {
      if(val.LayoutName === 'Stack')  await xcommand(`Video Layout SetLayout`, {LayoutName: 'Stack'});
    }

    await xcommand(`Video PresentationView Set`, {View: 'Maximized'});
  }

  device_data.video.monitor_preset_id = monitor_preset_id_2;
  if(b_ui)  updateUI({'video': {'monitor_preset_id': monitor_preset_id}});
}

/**********************************************************************************/
/**/
async function cbCallConnected(event) {
  handleLog('cbCallConnected', event);
  switch(event) {
  case 'Dialling':
  case 'Ringing':
//    await VideoOutputReset(`cbCallConnected=${event}`);
    break;
  case 'Connecting':
    break;
  case 'Connected':
    break;
  }
}

async function cbCallDisconnected(event) {
  handleLog('cbCallDisconnected', event);
  if(SHOW_PAGE_DISPLAY)   await VideoOutputReset('cbCallDisconnected');
}

async function cbWidgetAction(event, cb_from='') {
  handleLog('cbWidgetAction', `cb_from=${cb_from}`, event);
  let event_type = '';
  if(!!event.Type) event_type = event.Type.toLowerCase();
  if(event_type === 'pressed')  return;

  switch(event.PanelId) {
  case PANEL_ID:
    await updateUI({}, true);
    break;
  }

  const event_value = event.Value;
  switch(event.WidgetId) {
  case widgetIds.monitor_role_1:
  case widgetIds.monitor_role_2:
  case widgetIds.monitor_role_3:
    if(event_type === 'released') {
      device_data.video.monitor_preset_id = PRESET_5;
      await VideoOutputMonitor(event);
    }
    break;

  case widgetIds.monitor_role_save:
    if(event_type === 'released')
      await cbSaveData(event);
    break;

  case widgetIds.monitor_preset:
    if(event_value == PRESET_5) {
      await openPanelPage(PANEL_ID, widgetIds.page_monitor_role_advanced);
      await updateUI({'video': {'ui': 'monitor_role_advanced'}}, true)
    }
    else {
      event = `cbWidgetAction=${event.WidgetId}=${event_value}`;
      await VideoOutputReset(event, event_value, true);
    }
    break;
  }
}

async function cbSaveData(event) {
  handleLog('cbSaveData', event, 'device_data', device_data);
  await saveData();
  await displayAlertMessage({Title: '', Text: CONFIG_SAVE_TEXT, Duration: CONFIG_SAVE_DURATION});
}

/**********************************************************************************/
/**/
let page_audio = '';
let page_camera = '';
let page_control = '';
let page_display = '';
let page_advanced = '';
async function rebuildUI() {
  handleLog('rebuildUI');

  if(SHOW_PAGE_DISPLAY && !page_display) {
    const v_monitors = await xapi.config.get('Video Monitors').catch(e => {return ''});
    const row_display_3_role = (NUM_DISPLAY == 3) ? ROW_DISPLAY_3_ROLE : '';
    const row_remark_vo_reset =  ROW_REMARK_VO_RESET.replace('%CONFIG_MONITORS%', `Monitors=${v_monitors}`);
    const row_display_preset_advanced = (SHOW_PAGE_ADVANCED) ? ROW_DISPLAY_PRESET_ADVANCED : '';
    handleDebug('rebuildUI', `v_monitors=${v_monitors}`);

    page_display = (SHOW_PAGE_DISPLAY) ? PAGE_DISPLAY.replace('%ROW_DISPLAY_PRESET_ADVANCED%', row_display_preset_advanced).replace('%ROW_REMARK_VO_RESET%', row_remark_vo_reset) : '';
    page_advanced = (SHOW_PAGE_ADVANCED) ? PAGE_ADVANCED.replace('%ROW_DISPLAY_3_ROLE%', row_display_3_role).replace('%ROW_REMARK_VO_RESET%', row_remark_vo_reset) : '';
  }

  /*
  handleLog('rebuildUI', `page_display=${page_display}`);
  handleLog('rebuildUI', `page_advanced=${page_advanced}`);
  */
  const xml = PANEL_ROOM_CONTROL.replace('%PAGE_CAMERA%', page_camera).replace('%PAGE_AUDIO%', page_audio).replace('%PAGE_DISPLAY%', page_display).replace('%PAGE_ADVANCED%', page_advanced).replace('%PAGE_CONTROL%', page_control);
  return xml;
}

let widget_pending_update = {};
let timer_update_ui = 0;
async function delayed_updateUI() {
  const widgets = widget_pending_update;
  const b_widget = (Object.keys(widgets).length > 0) ? true : false;
  handleLog('delayed_updateUI', `b_widget=${b_widget}, widgets`, widgets);

  if(SHOW_PAGE_DISPLAY && (!b_widget || C.VIDEO in widgets)) {
    const monitor_preset_id = device_data.video.monitor_preset_id;
    const v_monitors = await xapi.config.get('Video Monitors').catch(e => {return ''});
    handleDebug('delayed_updateUI', `widgets`, widgets, `monitor_preset_id=${monitor_preset_id}, v_monitors=${v_monitors}`, device_data);

    if(SHOW_PAGE_ADVANCED) {
      const setting = device_data.video.monitor_preset[monitor_preset_id].output_connecters;
      for (const val of Object.values(setting)) {
        if(val.id <= NUM_DISPLAY) {
          if(val.id == '1')         await setWidgetValue(widgetIds.monitor_role_1, val.MonitorRole);
          else if(val.id == '2')    await setWidgetValue(widgetIds.monitor_role_2, val.MonitorRole);
          else if(val.id == '3' && val.id == NUM_DISPLAY)   await setWidgetValue(widgetIds.monitor_role_3, val.MonitorRole);
        }
      }
    }

    await setWidgetValue(widgetIds.monitor_preset, monitor_preset_id);

    if(v_monitors)    await setWidgetValue(widgetIds.vc_reset_1, ROW_REMARK_VO_RESET.replace('%CONFIG_MONITORS%', `Monitors=${v_monitors}`));
  }

  widget_pending_update = {};
}

async function updateUI(widgets={}, force=false) {
  const cnt_widget = Object.keys(widgets).length;
  handleLog('updateUI', `force=${force}, timer_update_ui=${timer_update_ui}`, `cnt_widget=${cnt_widget}`, widgets);

  if(cnt_widget > 0) {
    const key = Object.keys(widgets)[0];
    if(!widget_pending_update.hasOwnProperty(key))  widget_pending_update[key] = [];

    widget_pending_update[key].push(widgets);
  }

  clearTimeout(timer_update_ui);
  if(force) await delayed_updateUI();
  else      timer_update_ui = setTimeout(delayed_updateUI, TIMER_UPDATE_UI);
}

async function listenOn() {
  handleLog('listenOn');
  await xapi.event.on('CallDisconnect', (event) => cbCallDisconnected(event));
  await xapi.event.on('UserInterface Extensions Panel Clicked', (event) => cbWidgetAction(event, 'panel_cliced'));
  await xapi.event.on('UserInterface Extensions Panel Close', (event) => cbWidgetAction(event, 'panel_close'));
  await xapi.event.on('UserInterface Extensions Panel Open', (event) => cbWidgetAction(event, 'panel_open'));
  await xapi.event.on('UserInterface Extensions Widget Action', (event) => cbWidgetAction(event, 'widget_action'));

  await xapi.status.on('Call Status', (event) => cbCallConnected(event));

  if(SHOW_PAGE_DISPLAY || SHOW_PAGE_ADVANCED) {
    await xapi.config.on('Video Monitors', (event) => updateUI({'video': {'monitors': event}}));
  }
}

/**********************************************************************************/
/**/
async function initConfig(cb_from='') {
  const su = await xapi.status.get('SystemUnit').catch(e => {return ''});
  const b_idle = await isIdle();
  const ci_name = await xapi.status.get('UserInterface ContactInfo Name').catch(e => {return ''});
  const vo_connector = await xapi.status.get('Video Output Connector').catch(e => {return []});
  const v_monitors = await xapi.config.get('Video Monitors').catch(e => {return ''});
  handleLog('initConfig', `version=${MACRO_VERSION}, cb_from=${cb_from}, b_idle=${b_idle}, ci_name=${ci_name}, v_monitors=${v_monitors}`);
  handleDebug('initConfig', `vo_connector`, vo_connector);

  await xconfig('Macros AutoStart', 'On');
  await xconfig('Macros Mode', 'On');
  await xconfig('Macros UnresponsiveTimeout', '5');
  await xconfig('HttpClient Mode', 'On');
  await xconfig('HttpClient AllowHTTP', 'False');
  await xconfig('HttpClient AllowInsecureHTTPS', 'True');

  if(su && hasSensor(su.Software.Name)) {
    await xconfig('WebEngine Mode', 'On');
    await xconfig('WebEngine Features WebGL', 'On');
    await xconfig('RoomAnalytics AmbientNoiseEstimation Mode', 'On');
    await xconfig('RoomAnalytics PeopleCountOutOfCall', 'On');
    await xconfig('RoomAnalytics PeoplePresenceDetector', 'On');
    await xconfig('Standby WakeupOnMotionDetection', 'On');
  }

  if(ci_name)   await xconfig(`SystemUnit Name`, ci_name);

  await restoreData();
  if(device_data.video) {
    for (const [key, value] of Object.entries(MONITORS_PRESET)) {
      if(key != PRESET_5)   device_data.video.monitor_preset[key] = JSON.parse(JSON.stringify(value));
    }
  }

  device_status.cnt_vo_connector = vo_connector.length;

  if(b_idle) {
    if(SHOW_PAGE_DISPLAY)   await VideoOutputReset(C.INIT_CONFIG, '', false);
  }

  const xml = await rebuildUI();
  await restoreExtension(xml, REMOVE_PANEL);

  if(cb_from == C.INIT_CONFIG) {
    await listenOn();
  }
}

/**********************************************************************************/
/* Auxiliary functions
*/
const C = {
  'INIT_CONFIG':    'init_config',
  'ON':             'on',
  'OFF':            'off',
  'AUDIO':          'audio',
  'VIDEO':          'video',
};

async function displayAlertMessage(value) {
  await xcommand(`UserInterface Message Alert Display`, value);
}

async function setVideoOutputConnectorMonitorRole(id, role) {
  handleLog('setVideoOutputConnectorMonitorRole', `id=${id}, role=${role}`);
  await xconfig(`Video Output Connector ${id} MonitorRole`, role);
}

async function isIdle() {
  const su_state = await xapi.status.get('SystemUnit State').catch(e => {return ''});
  const local_preso = await xapi.status.get('Conference Presentation LocalInstance SendingMode').catch(e => {return ''});
  const wb_session = await xapi.status.get(`Whiteboard Session`).catch(e => {return []});
  let cnt_call = 0;

  if(su_state)  cnt_call = parseInt(su_state.NumberOfActiveCalls) + parseInt(su_state.NumberOfInProgressCalls) + parseInt(su_state.NumberOfSuspendedCalls);

  const b_idle = (cnt_call || local_preso.length || wb_session.length)? false : true;
  handleDebug('isIdle', `b_idle=${b_idle}, cnt_call=${cnt_call}, local_preso=${local_preso}, wb_session=`, wb_session);
  return b_idle;
}

const HTTP_POST_TIMEOUT = 5;
async function postHttpClient(url, header, data, timeout=HTTP_POST_TIMEOUT) {
  await xapi.command('HttpClient Post', {Header: header, AllowInsecureHTTPS: true, Timeout: timeout, Url: url}, data)
  .then(r => handleLog('postHttpClient', `status=${r.StatusCode}, url=${url}, data=${data}`))
  .catch(e => handleError('postHttpClient', `url=${url}, timeout=${timeout}, data=${data}`, e));
}

async function openPanelPage(panel_id, page_id='') {
  handleLog('openPanelPage', `panel_id=${panel_id}, page_id=${page_id}`);
  const value = (page_id)? {PanelId: panel_id, PageId: page_id} : {PanelId: panel_id};
  await xcommand('UserInterface Extensions Panel Open', value);
}

async function setWidgetValue(widget_id, value) {
  handleLog('setWidgetValue', `widget_id=${widget_id}, value=${value}`);
  const widget_type = widget_id.split('-')[0];
  if(widget_type === 'toggle')  value = value.toLowerCase();
  await xcommand('UserInterface Extensions Widget SetValue', {WidgetId: widget_id, Value: value});
}

async function unsetWidgetValue(widget_id) {
  handleLog('unsetWidgetValue', `widget_id=${widget_id}`);
  const widget_type = widget_id.split('-')[0];
  await xcommand('UserInterface Extensions Widget UnsetValue', {WidgetId: widget_id});
}

/**/
async function getTimeNow(sec=1) {
  let ts = (new Date()).getTime();
  if(sec) ts = Math.round(ts/1000);
  return ts;
}

async function getLocalSystemTime() {
  return await xapi.Status.Time.SystemTime.get();  // Hope for NTP is sync'd after delayed sceonds
}

async function getSecondToNext(f_hour, f_minute=0, sys_time='') {
  if(!sys_time)   sys_time = await getLocalSystemTime();
  f_hour = parseInt(f_hour);
  f_minute = parseInt(f_minute);

  const t_hour = await getHour(sys_time);
  const t_min = await getMinute(sys_time);
  const time_now = new Date();
  const time_next = new Date();
  if(t_hour >= f_hour && t_min >= f_minute) f_hour += 24;
  time_next.setHours(f_hour, f_minute, 0, 0);

  const diff_sec = Math.round((time_next.getTime() - time_now.getTime())/1000);
  handleLog('getSecondToNext', `sys_time=${sys_time}, t_hour=${t_hour}, t_min=${t_min}, f_hour=${f_hour}, f_minute=${f_minute}, time_now=${time_now}, time_next=${time_next}, diff_sec=${diff_sec}`);
  return diff_sec;
}

async function getDate(sys_time) {
  return sys_time.split('T')[0];
}

async function getHour(sys_time) {
  return parseInt(sys_time.split('T')[1].split(':')[0]);
}

async function getMinute(sys_time) {
  return parseInt(sys_time.split('T')[1].split(':')[1]);
}

/**/
function handleDebug(func, ...args) {
  console.debug(`${func}:`, JSON.stringify(args));
}

function handleError(func, ...args) {
  console.error(`${func}:`, JSON.stringify(args));
}

function handleLog(func, ...args) {
  console.log(`${func}:`, JSON.stringify(args));
}

function hasSensor(softwareName) {
  handleLog('hasSensor', `softwareName=${softwareName}`);
  switch(softwareName) {
  case 's53200': // sunrise (Webex Room Series + WebexBoard)
  case 's53300': // zenith (Room Kit Pro / Room 70 G2 / Panorama / Desk Pro)
    return true;
  default:
    return false;
  }
}

async function xcommand(path, value='') {
  handleLog('xcommand', `path=${path}`, value);
  return await xapi.command(path, value)
    .catch(e => handleError('xcommand', `path=${path}, value=${JSON.stringify(value)}`, e));
}

async function xconfig(path, value) {
  handleLog('xconfig', `path=${path}`, value);
  return await xapi.config.set(path, value)
    .catch(e => handleError('xconfig', `path=${path}, value=${JSON.stringify(value)}`, e));
}

/**********************************************************************************/
/* XML
*/
const ROW_REMARK_VO_RESET = 'Remark: Settings will be reverted to default after each call. Info: %CONFIG_MONITORS%';

const ROW_DISPLAY_3_ROLE = `
<Row>
<Name>Display 3 Role</Name>
<Widget>
  <WidgetId>group-monitor_role_3</WidgetId>
  <Type>GroupButton</Type>
  <Options>size=4;columns=4</Options>
  <ValueSpace>
    <Value>
      <Key>Auto</Key>
      <Name>Auto</Name>
    </Value>
    <Value>
      <Key>First</Key>
      <Name>First</Name>
    </Value>
    <Value>
      <Key>Second</Key>
      <Name>Second</Name>
    </Value>
    <Value>
      <Key>Third</Key>
      <Name>Third</Name>
    </Value>
    <Value>
      <Key>PresentationOnly</Key>
      <Name>Presentation Only</Name>
    </Value>
    <Value>
      <Key>Recorder</Key>
      <Name>All-in-One</Name>
    </Value>
  </ValueSpace>
</Widget>
</Row>
`

const ROW_DISPLAY_PRESET_ADVANCED = `
<Value>
  <Key>5</Key>
  <Name>Advanced Settings</Name>
</Value>
`

const PAGE_DISPLAY = `
<Page>
  <Name>Display</Name>
  <Row>
    <Name>Row</Name>
    <Widget>
      <WidgetId>group-monitor_preset</WidgetId>
      <Type>GroupButton</Type>
      <Options>size=4;columns=1</Options>
      <ValueSpace>
        <Value>
          <Key>1</Key>
          <Name>Video on Left || Presentation on Right</Name>
        </Value>
        <Value>
          <Key>2</Key>
          <Name>Presentation on Left || Video on Right</Name>
        </Value>
        <Value>
          <Key>3</Key>
          <Name>Presentation Only on all Display</Name>
        </Value>
        <Value>
          <Key>4</Key>
          <Name>Video &amp; Presentation on the same Display</Name>
        </Value>
        %ROW_DISPLAY_PRESET_ADVANCED%
      </ValueSpace>
    </Widget>
  </Row>
  <Row>
    <Name/>
    <Widget>
      <WidgetId>button-monitor_role_save</WidgetId>
      <Name>Save current settings as default</Name>
      <Type>Button</Type>
      <Options>size=4</Options>
    </Widget>
  </Row>
  <Row>
    <Name/>
    <Widget>
      <WidgetId>text-vc_reset_1</WidgetId>
      <Name>%ROW_REMARK_VO_RESET%</Name>
      <Type>Text</Type>
      <Options>size=4;fontSize=small;align=left</Options>
    </Widget>
  </Row>
  <PageId>page-monitor_role_preset</PageId>
  <Options>hideRowNames=1</Options>
</Page>
`

const PAGE_ADVANCED = `
<Page>
  <Name>Advanced</Name>
  <Row>
    <Name>Display 1 (Left) Role</Name>
    <Widget>
      <WidgetId>group-monitor_role_1</WidgetId>
      <Type>GroupButton</Type>
      <Options>size=4;columns=3</Options>
      <ValueSpace>
        <Value>
          <Key>Auto</Key>
          <Name>Auto</Name>
        </Value>
        <Value>
          <Key>First</Key>
          <Name>First</Name>
        </Value>
        <Value>
          <Key>Second</Key>
          <Name>Second</Name>
        </Value>
        <Value>
          <Key>PresentationOnly</Key>
          <Name>Presentation Only</Name>
        </Value>
        <Value>
          <Key>Recorder</Key>
          <Name>All-in-One</Name>
        </Value>
      </ValueSpace>
    </Widget>
  </Row>
  <Row>
    <Name>Display 2 (Right) Role</Name>
    <Widget>
      <WidgetId>group-monitor_role_2</WidgetId>
      <Type>GroupButton</Type>
      <Options>size=4;columns=3</Options>
      <ValueSpace>
        <Value>
          <Key>Auto</Key>
          <Name>Auto</Name>
        </Value>
        <Value>
          <Key>First</Key>
          <Name>First</Name>
        </Value>
        <Value>
          <Key>Second</Key>
          <Name>Second</Name>
        </Value>
        <Value>
          <Key>PresentationOnly</Key>
          <Name>Presentation Only</Name>
        </Value>
        <Value>
          <Key>Recorder</Key>
          <Name>All-in-One</Name>
        </Value>
      </ValueSpace>
    </Widget>
  </Row>
  %ROW_DISPLAY_3_ROLE%
  <Row>
    <Name/>
    <Widget>
      <WidgetId>button-monitor_role_save</WidgetId>
      <Name>Save current settings as default</Name>
      <Type>Button</Type>
      <Options>size=4</Options>
    </Widget>
  </Row>
  <Row>
    <Name/>
    <Widget>
      <WidgetId>text-vc_reset_1</WidgetId>
      <Name>%ROW_REMARK_VO_RESET%</Name>
      <Type>Text</Type>
      <Options>size=4;fontSize=small;align=left</Options>
    </Widget>
  </Row>
  <PageId>page-monitor_role_advanced</PageId>
  <Options/>
</Page>
`

const PANEL_ROOM_CONTROL = `
<Extensions>
  <Panel>
    <PanelId>${PANEL_ID}</PanelId>
    <Location>HomeScreenAndCallControls</Location>
    <Type>Statusbar</Type>
    <Icon>${PANEL_BTN_ICON}</Icon>
    <Name>${PANEL_BTN_NAME}</Name>
    <ActivityType>Custom</ActivityType>
    %PAGE_CONTROL%
    %PAGE_AUDIO%
    %PAGE_CAMERA%
    %PAGE_DISPLAY%
    %PAGE_ADVANCED%
  </Panel>
</Extensions>
`

async function restoreExtension(xml, remove_panel=[]) {
  handleLog('restoreExtension', `PanelId=${PANEL_ID}, remove_panel=`, remove_panel);
  for (const val of remove_panel)
    await xcommand(`UserInterface Extensions Panel Remove`, {PanelId: val});

  await xapi.Command.UserInterface.Extensions.Panel.Save({PanelId: PANEL_ID}, xml)
  .catch(e => handleError('restoreExtension', `PanelId=${PANEL_ID}`, e));
}

/**********************************************************************************/
/* Data Storage
*/
async function clearData(cb_name='') {
  handleLog('clearData', `cb_name=${cb_name}`);
  device_data = JSON.parse(JSON.stringify(DEVICE_DATA_C));
  await saveData();
}

async function saveData() {
  device_data.ts = await getLocalSystemTime();
  await mem.write(DEVICE_DATA, device_data);
  handleLog('saveData', `device_data`, device_data);
}

async function restoreData() {
  try {
    device_data = await mem.read(DEVICE_DATA);

    if(!device_data.version || device_data.version != DEVICE_DATA_C.version || !device_data.ts) {
      await clearData('restoreData:version');
    }
    else if(device_data.reset_by_date) {
      const sys_time = await getLocalSystemTime();
      const date_now = await getDate(sys_time);
      const date_ts = await getDate(device_data.ts);
      handleDebug('restoreData', `sys_time=${sys_time}, date_now=${date_now}, date_ts=${date_ts}`);

      if(date_now != date_ts)   await clearData('restoreData:ts');
    }
  }
  catch(e) {
    handleDebug('restoreData', `e`, JSON.stringify(e));
    await clearData('restoreData:catch');
  }

  handleLog('restoreData', DEVICE_DATA, device_data);
}

/**********************************************************************************/
/**
 * Author and Project Lead: Zacharie Gignac
 * Co-Author and Tester: Robert McGonigle
 *
 * CIFSS - Université Laval
 * Harvard University Information Technology
 *
 * Released: November 2020
 * Updated: February 2021
 *
 * Description; Asynchronous read/write permanent memory
 *
 * Use: Allow the storage of persistant information while working within the Macro editor of Cisco Video Room Devices
 *  For more information, please refer to the guide at
 *  https://github.com/Bobby-McGonigle/Cisco-RoomDevice-Macro-Projects-Examples/tree/master/Macro%20Memory%20Storage
 */

 const config = {
  "storageMacro": "Memory_Storage", //Name for Storage Macro
  "autoImport": {
      "mode": "false", //Use: <true, false, "activeOnly", "custom">
      "customImport": []//Only used when Auto import mode is set to custom
  }
};

var mem = {
  "localScript": module.name
};

function memoryInit() {
  return new Promise((resolve) => {
      xapi.command('macros macro get', {
          Content: 'True',
          Name: config.storageMacro
      }).then((event) => {
          try {
            let raw = event.Macro[0].Content.replace(/var.*memory.*=\s*{/g, '{')
            let store = JSON.parse(raw)
          }
          catch(e) {
            console.warn('empty storage');
            throw '';
          }
      }).catch(e => {
          console.warn('Uh-Oh, no storage Macro found, building "' + config.storageMacro);
          xapi.command('macros macro save', {
              Name: config.storageMacro
          },
              `var memory = {\n\t"./_$Info": {\n\t\t"Warning": "Do NOT modify this document, as other Scripts/Macros may rely on this information", \n\t\t"AvailableFunctions": {\n\t\t\t"local": ["mem.read('key')", "mem.write('key', 'value')", "mem.remove('key')", "mem.print()"],\n\t\t\t"global": ["mem.read.global('key')", "mem.write.global('key', 'value')", "mem.remove.global('key')", "mem.print.global()"]\n\t\t},\n\t\t"Guide": "https://github.com/Bobby-McGonigle/Cisco-RoomDevice-Macro-Projects-Examples/tree/master/Macro%20Memory%20Storage"\n\t},\n\t"ExampleKey": "Example Value"\n}`
          ).then(() => {
              mem.print.global();
          });

      });
      resolve();
  });
};

memoryInit().then(() => {
}).catch(e => {
  console.error(e)
});

mem.read = function (key) {
  return new Promise((resolve, reject) => {
      xapi.command('Macros Macro Get', {
          Content: 'True',
          Name: config.storageMacro
      }).then((event) => {
          let raw = event.Macro[0].Content.replace(/var.*memory.*=\s*{/g, '{')
          let store = JSON.parse(raw)
          let temp;
          if (store[mem.localScript] == undefined) {
              store[mem.localScript] = {}
              temp = store[mem.localScript]
          } else {
              temp = store[mem.localScript]
          }
          if (temp[key] != undefined) {
              resolve(temp[key])
          } else {
              reject(new Error('Local Read Error. Object Key: "' + key + '" not found in \'' + config.storageMacro + '\' from script "' + mem.localScript + '"'))
          }
      })
  });
}

mem.read.global = function (key) {
  return new Promise((resolve, reject) => {
      xapi.command('Macros Macro Get', {
          Content: 'True',
          Name: config.storageMacro
      }).then((event) => {
          let raw = event.Macro[0].Content.replace(/var.*memory.*=\s*{/g, '{')
          let store = JSON.parse(raw)
          if (store[key] != undefined) {
              resolve(store[key])
          } else {
              reject(new Error('Glabal Read Error. Object Key: "' + key + '" not found in \'' + config.storageMacro + '\''))
          }
      })
  });
}

mem.write = function (key, value) {
  return new Promise((resolve) => {
      xapi.command('Macros Macro Get', {
          Content: 'True',
          Name: config.storageMacro
      }).then((event) => {
          let raw = event.Macro[0].Content.replace(/var.*memory.*=\s*{/g, '{');
          let store = JSON.parse(raw);
          let temp;
          if (store[mem.localScript] == undefined) {
              store[mem.localScript] = {};
              temp = store[mem.localScript];
          } else {
              temp = store[mem.localScript]
          };
          temp[key] = value;
          store[mem.localScript] = temp;
          let newStore = JSON.stringify(store, null, 4);
          xapi.command('Macros Macro Save', {
              Name: config.storageMacro
          },
              `var memory = ${newStore}`
          ).then(() => {
              console.debug('Local Write Complete => "' + mem.localScript + '" : {"' + key + '" : "' + JSON.stringify(value) + '"}');
              resolve(value);
          });
      });
  });
};

mem.write.global = function (key, value) {
  return new Promise((resolve) => {
      xapi.command('Macros Macro Get', {
          Content: 'True',
          Name: config.storageMacro
      }).then((event) => {
          let raw = event.Macro[0].Content.replace(/var.*memory.*=\s*{/g, '{');
          let store = JSON.parse(raw);
          store[key] = value;
          let newStore = JSON.stringify(store, null, 4);
          xapi.command('Macros Macro Save', {
              Name: config.storageMacro
          },
              `var memory = ${newStore}`
          ).then(() => {
              console.debug('Global Write Complete => "' + config.storageMacro + '" : {"' + key + '" : "' + JSON.stringify(value) + '"}');
              resolve(value);
          });
      });
  });
};

mem.remove = function (key) {
  return new Promise((resolve, reject) => {
      xapi.command('Macros Macro Get', {
          Content: 'True',
          Name: config.storageMacro
      }).then((event) => {
          let raw = event.Macro[0].Content.replace(/var.*memory.*=\s*{/g, '{');
          let store = JSON.parse(raw);
          let temp;
          if (store[mem.localScript] == undefined) {
              store[mem.localScript] = {};
              temp = store[mem.localScript];
          } else {
              temp = store[mem.localScript];
          };
          if (temp[key] != undefined) {
              let track = temp[key];
              delete (temp[key]);
              store[mem.localScript] = temp;
              let newStore = JSON.stringify(store);
              xapi.command('Macros Macro Save', {
                  Name: config.storageMacro
              },
                  `var memory = ${newStore}`
              ).then(() => {
                  console.warn('WARNING: Local Object Key {"' + key + '" : "' + track + '"} has been deleted from ' + config.storageMacro + '. Deletetion occured in script "' + mem.localScript + '"');
                  resolve(key);
              });
          } else {
              reject(new Error('Local Delete Error. Object Key: "' + key + '" not found under Object "' + mem.localScript + '{}" in "' + config.storageMacro + '"'));
          };
      });
  });
};

mem.remove.global = function (key) {
  return new Promise((resolve, reject) => {
      xapi.command('Macros Macro Get', {
          Content: 'True',
          Name: config.storageMacro
      }).then((event) => {
          let raw = event.Macro[0].Content.replace(/var.*memory.*=\s*{/g, '{');
          let store = JSON.parse(raw);
          if (store[key] != undefined) {
              let track = store[key];
              delete (store[key]);
              let newStore = JSON.stringify(store, null, 4);
              xapi.command('Macros Macro Save', {
                  Name: config.storageMacro
              },
                  `var memory = ${newStore}`
              ).then(() => {
                  console.warn('WARNING: Global Object Key {"' + key + '" : "' + track + '"} has been deleted from ' + config.storageMacro + '. Deletetion occured in script "' + mem.localScript + '"');
                  resolve(key);
              });
          } else {
              reject(new Error('Global Delete Error. Object Key: "' + key + '" not found in "' + config.storageMacro + '"'))
          };
      });
  });
};

mem.print = function () {
  return new Promise((resolve, reject) => {
      mem.read.global(mem.localScript).then((log) => {
          console.log(log);
          resolve(log);
      }).catch(e => new Error('Local Print Error: No local key found in "' + config.storageMacro + '"'));
  });
};

mem.print.global = function () {
  return new Promise((resolve, reject) => {
      xapi.command('Macros Macro Get', {
          Content: 'True',
          Name: config.storageMacro
      }).then((event) => {
          let raw = event.Macro[0].Content.replace(/var.*memory.*=\s*{/g, '{');
          let store = JSON.parse(raw);
          console.log(store);
          resolve(store);
      });
  });
};

mem.info = function () {
      mem.read.global("./_$Info").then((log) => {
          console.log(log);
  });
};

/**********************************************************************************/
/* Start Here
*/
setTimeout(initConfig, TIMER_INIT_CONFIG, C.INIT_CONFIG);
