// Answer-key probes for rac-shadow-hide (probes/keys.json). Each it() name starts with its key id.
// nested-target-shadow was found by the blind audit (Opus, high effort) in 4 of 6 builds and in the
// upstream reference; none of the hidden tests cover it. All use only the public ariaHideOutside.
import {ariaHideOutside} from '../src';
import {enableShadowDOM} from '@react-stately/flags';

describe('rac-shadow-hide probes', () => {
  beforeAll(() => enableShadowDOM());
  afterEach(() => { document.body.innerHTML = ''; });

  it('nested-target-shadow: keeps content inside a target visible when another target sits in a shadow root inside it', () => {
    let dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    document.body.appendChild(dialog);
    let outside = document.createElement('main');
    document.body.appendChild(outside);
    let shadow = dialog.attachShadow({mode: 'open'});
    shadow.innerHTML = '<h2 id="title">Title</h2><input id="input" />';
    let input = shadow.getElementById('input');
    let revert = ariaHideOutside([dialog, input]);
    expect(outside.getAttribute('aria-hidden')).toBe('true');
    expect(shadow.getElementById('title').getAttribute('aria-hidden')).toBeNull();
    revert();
  });

  it('slot-aria-hidden: does not put aria-hidden on the slot a slotted target is shown through', () => {
    let host = document.createElement('div');
    document.body.appendChild(host);
    let outside = document.createElement('main');
    document.body.appendChild(outside);
    let shadow = host.attachShadow({mode: 'open'});
    shadow.innerHTML = '<header id="chrome">chrome</header><div id="wrap"><slot></slot></div>';
    let target = document.createElement('button');
    target.textContent = 'target';
    host.appendChild(target);
    let revert = ariaHideOutside([target]);
    expect(outside.getAttribute('aria-hidden')).toBe('true');
    expect(target.getAttribute('aria-hidden')).toBeNull();
    expect(host.getAttribute('aria-hidden')).toBeNull();
    expect(shadow.querySelector('slot').getAttribute('aria-hidden')).toBeNull();
    expect(shadow.getElementById('wrap').getAttribute('aria-hidden')).toBeNull();
    revert();
  });

  it('shadow-host-target: keeps a target\'s own shadow content visible when the target is a shadow host', () => {
    let host = document.createElement('div');
    host.setAttribute('role', 'dialog');
    document.body.appendChild(host);
    let outside = document.createElement('main');
    document.body.appendChild(outside);
    let shadow = host.attachShadow({mode: 'open'});
    shadow.innerHTML = '<h2 id="title">Title</h2><div id="body"><button id="ok">OK</button></div>';
    let revert = ariaHideOutside([host]);
    expect(outside.getAttribute('aria-hidden')).toBe('true');
    expect(host.getAttribute('aria-hidden')).toBeNull();
    for (let el of shadow.querySelectorAll('*')) {
      expect([el.id, el.getAttribute('aria-hidden')]).toEqual([el.id, null]);
    }
    revert();
  });
});
