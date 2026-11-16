// Found by the blind audit (Opus, high effort) in 4 of 6 builds and in the upstream reference;
// none of the hidden tests cover it. Each it() name starts with the probe id.
import {ariaHideOutside} from '../src';
import {enableShadowDOM} from '@react-stately/flags';

describe('rac-shadow-hide probes', () => {
  beforeAll(() => enableShadowDOM());
  it('nested_target_in_shadow_root: keeps content inside a target visible when another target sits in a shadow root inside it', () => {
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
});
