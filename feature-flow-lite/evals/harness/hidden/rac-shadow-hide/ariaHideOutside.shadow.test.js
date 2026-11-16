/*
 * Hidden tests for the rac-shadow-hide eval scenario. Ported from upstream
 * adobe/react-spectrum: the shadow DOM blocks of ariaHideOutside.test.js as of
 * the fix in #10288 (without shadow-dom-testing-library, which the pinned
 * commit doesn't have), plus extra cases at the end.
 *
 * Copyright 2020 Adobe. Licensed under the Apache License, Version 2.0.
 */

import {act, createShadowRoot, render} from '@react-spectrum/test-utils-internal';
import {ariaHideOutside} from '../src';
import {enableShadowDOM} from '@react-stately/flags';
import React from 'react';
import ReactDOM from 'react-dom';

describe('ariaHideOutside with shadow DOM', function () {
  beforeAll(() => {
    enableShadowDOM();
  });

  it('should hide everything except the provided element [button]', function () {
    const {shadowRoot, shadowHost, cleanup} = createShadowRoot();
    let Wrapper = () =>
      ReactDOM.createPortal(
        <div>
          <input type="checkbox" />
          <button>Button</button>
          <input type="checkbox" />
        </div>,
        shadowRoot
      );
    render(<Wrapper />);

    let button = shadowRoot.querySelector('button');
    let checkboxes = [...shadowRoot.querySelectorAll('input[type=checkbox]')];
    let revert = ariaHideOutside([button]);

    expect(checkboxes[0]).toHaveAttribute('aria-hidden', 'true');
    expect(checkboxes[1]).toHaveAttribute('aria-hidden', 'true');
    expect(button).not.toHaveAttribute('aria-hidden');
    expect(shadowHost).not.toHaveAttribute('aria-hidden');

    revert();
    cleanup();
  });

  function isEffectivelyHidden(element) {
    while (element && element.getAttribute) {
      const ariaHidden = element.getAttribute('aria-hidden');
      if (ariaHidden === 'true') {
        return true;
      } else if (ariaHidden === 'false') {
        return false;
      }
      const rootNode = element.getRootNode ? element.getRootNode() : document;
      element = element.parentNode || (rootNode !== document ? rootNode.host : null);
    }
    return false;
  }

  describe('ariaHideOutside with Shadow DOM', () => {
    let cleanup;
    afterEach(async () => {
      cleanup?.();
      cleanup = undefined;
      // Remove anything leftover in the body. Use firstChild rather than iterating
      // the live `children` collection, which skips elements as it mutates.
      while (document.body.firstChild) {
        document.body.removeChild(document.body.firstChild);
      }
      // Close out any pending observers
      await act(async () => Promise.resolve());
    });

    it('should not apply aria-hidden to direct parents of the shadow root', () => {
      const div1 = document.createElement('div');
      div1.id = 'parent1';
      const div2 = document.createElement('div');
      div2.id = 'parent2';
      div1.appendChild(div2);
      document.body.appendChild(div1);

      const shadowRoot = div2.attachShadow({mode: 'open'});
      const ExampleModal = () =>
        ReactDOM.createPortal(
          <>
            <div id="modal" role="dialog">
              Modal Content
            </div>
          </>,
          shadowRoot
        );
      render(<ExampleModal />);

      cleanup = ariaHideOutside([shadowRoot.getElementById('modal')], shadowRoot);

      expect(isEffectivelyHidden(document.getElementById('parent1'))).toBeFalsy();
      expect(isEffectivelyHidden(document.getElementById('parent2'))).toBeFalsy();
      expect(isEffectivelyHidden(document.body)).toBeFalsy();

      expect(isEffectivelyHidden(shadowRoot.getElementById('modal'))).toBeFalsy();
    });

    it('should correctly apply aria-hidden based on shadow DOM structure', () => {
      const div1 = document.createElement('div');
      div1.id = 'parent1';
      const div2 = document.createElement('div');
      div2.id = 'parent2';
      div1.appendChild(div2);
      document.body.appendChild(div1);

      const shadowRoot = div2.attachShadow({mode: 'open'});
      shadowRoot.innerHTML = '<div id="modal" role="dialog">Modal Content</div>';

      shadowRoot.innerHTML += '<div id="insideContent">Inside Shadow Content</div>';

      const outsideContent = document.createElement('div');
      outsideContent.id = 'outsideContent';
      outsideContent.textContent = 'Outside Content';
      document.body.appendChild(outsideContent);

      cleanup = ariaHideOutside([shadowRoot.getElementById('modal')], shadowRoot);

      expect(isEffectivelyHidden(div1)).toBeFalsy();
      expect(isEffectivelyHidden(div2)).toBeFalsy();

      expect(isEffectivelyHidden(shadowRoot.querySelector('#insideContent'))).toBe(true);

      expect(isEffectivelyHidden(shadowRoot.querySelector('#modal'))).toBeFalsy();

      expect(isEffectivelyHidden(outsideContent)).toBe(true);

      expect(isEffectivelyHidden(document.body)).toBeFalsy();
    });

    it('should hide non-direct parent elements like header when modal is in Shadow DOM', () => {
      const header = document.createElement('header');
      header.id = 'header';
      document.body.appendChild(header);

      const div1 = document.createElement('div');
      div1.id = 'parent1';
      const div2 = document.createElement('div');
      div2.id = 'parent2';
      div1.appendChild(div2);
      document.body.appendChild(div1);

      const shadowRoot = div2.attachShadow({mode: 'open'});
      const modal = document.createElement('div');
      modal.id = 'modal';
      modal.setAttribute('role', 'dialog');
      modal.textContent = 'Modal Content';
      shadowRoot.appendChild(modal);

      cleanup = ariaHideOutside([modal]);

      expect(isEffectivelyHidden(header)).toBe(true);

      expect(isEffectivelyHidden(div1)).toBe(false);
      expect(isEffectivelyHidden(div2)).toBe(false);

      expect(isEffectivelyHidden(modal)).toBe(false);

      document.body.removeChild(header);
      document.body.removeChild(div1);
    });

    it('should handle a modal inside nested Shadow DOM structures and hide sibling content in the outer shadow root', () => {
      const outerDiv = document.createElement('div');
      document.body.appendChild(outerDiv);
      const outerShadowRoot = outerDiv.attachShadow({mode: 'open'});
      const innerDiv = document.createElement('div');
      outerShadowRoot.appendChild(innerDiv);
      const innerShadowRoot = innerDiv.attachShadow({mode: 'open'});

      const modal = document.createElement('div');
      modal.setAttribute('role', 'dialog');
      modal.textContent = 'Modal Content';
      innerShadowRoot.appendChild(modal);

      const outsideContent = document.createElement('div');
      outsideContent.textContent = 'Outside Content';
      document.body.appendChild(outsideContent);

      const siblingContent = document.createElement('div');
      siblingContent.textContent = 'Sibling Content';
      outerShadowRoot.appendChild(siblingContent);

      cleanup = ariaHideOutside([modal], innerShadowRoot);

      expect(isEffectivelyHidden(modal)).toBe(false);

      expect(isEffectivelyHidden(outsideContent)).toBe(true);

      expect(isEffectivelyHidden(siblingContent)).toBe(true);

      document.body.removeChild(outerDiv);
      document.body.removeChild(outsideContent);
    });

    it('should handle a modal inside deeply nested Shadow DOM structures', async () => {
      // Create a deep nested shadow DOM structure
      const createNestedShadowRoot = (depth, currentDepth = 0) => {
        const div = document.createElement('div');
        if (currentDepth < depth) {
          const shadowRoot = div.attachShadow({mode: 'open'});
          shadowRoot.appendChild(createNestedShadowRoot(depth, currentDepth + 1));
        } else {
          div.innerHTML = '<div id="modal" role="dialog">Modal Content</div>';
        }
        return div;
      };

      const nestedShadowRootContainer = createNestedShadowRoot(3); // Adjust the depth as needed
      document.body.appendChild(nestedShadowRootContainer);

      // Get the deepest shadow root
      const getDeepestShadowRoot = node => {
        while (node.shadowRoot) {
          node = node.shadowRoot.childNodes[0];
        }
        return node;
      };

      const deepestElement = getDeepestShadowRoot(nestedShadowRootContainer);
      const modal = deepestElement.querySelector('#modal');

      // Apply ariaHideOutside
      cleanup = ariaHideOutside([modal]);

      // Check visibility
      expect(modal.getAttribute('aria-hidden')).toBeNull();
      expect(isEffectivelyHidden(modal)).toBeFalsy();

      // Add checks for other elements as needed to ensure correct `aria-hidden` application
    });

    it('should handle dynamic content added to the shadow DOM after ariaHideOutside is applied', async () => {
      // This test checks if the MutationObserver logic within ariaHideOutside correctly handles new elements added to the shadow DOM
      const div1 = document.createElement('div');
      div1.id = 'parent1';
      document.body.appendChild(div1);

      const shadowRoot = div1.attachShadow({mode: 'open'});
      let ExampleDynamicContent = ({showExtraContent}) =>
        ReactDOM.createPortal(
          <>
            <div id="modal" role="dialog">
              Modal Content
            </div>
            {showExtraContent && <div id="extraContent">Extra Content</div>}
          </>,
          shadowRoot
        );

      render(<ExampleDynamicContent showExtraContent={false} />);

      // Apply ariaHideOutside
      cleanup = ariaHideOutside([shadowRoot.getElementById('modal')]);

      // Dynamically update the content inside the Shadow DOM
      render(<ExampleDynamicContent showExtraContent />);

      // Ideally, use a utility function to wait for the MutationObserver callback to run, then check expectations
      await waitForMutationObserver();

      // Expectations
      expect(shadowRoot.getElementById('extraContent').getAttribute('aria-hidden')).toBe('true');
    });
  });

  function waitForMutationObserver() {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  describe('ariaHideOutside with nested Shadow DOMs', () => {
    let cleanup;
    afterEach(() => {
      cleanup?.();
      cleanup = undefined;
      // Remove anything leftover in the body. Use firstChild rather than iterating
      // the live `children` collection, which skips elements as it mutates.
      while (document.body.firstChild) {
        document.body.removeChild(document.body.firstChild);
      }
    });

    it('should hide appropriate elements including those in nested shadow roots without targets', () => {
      // Set up the initial DOM with shadow hosts and content.
      document.body.innerHTML = `
      <div id="P1">
        <div id="C1"></div>
        <div id="C2"></div>
      </div>
      <div id="P2">
        <div id="C3"></div>
        <div id="C4"></div>
      </div>
    `;

      // Create the first shadow root for C3 and append children to it.
      const shadowHostC3 = document.querySelector('#C3');
      const shadowRootC3 = shadowHostC3.attachShadow({mode: 'open'});
      shadowRootC3.innerHTML = `
      <div id="innerC1">Inner Content C3-1</div>
      <div id="innerC2">Inner Content C3-2</div>
    `;

      // Create the second shadow root for C4 and append children to it.
      const shadowHostC4 = document.querySelector('#C4');
      const shadowRootC4 = shadowHostC4.attachShadow({mode: 'open'});
      shadowRootC4.innerHTML = `
      <div id="C5"></div>
      <div id="C6"></div>
    `;

      // Create a nested shadow root inside C6 and append a modal element to it.
      const divC6 = shadowRootC4.querySelector('#C6');
      const shadowRootC6 = divC6.attachShadow({mode: 'open'});
      shadowRootC6.innerHTML = `
      <div id="modal">Modal Content</div>
    `;

      // Execute ariaHideOutside targeting the modal and C1.
      const modalElement = shadowRootC6.querySelector('#modal');
      const c1Element = document.querySelector('#C1');
      cleanup = ariaHideOutside([modalElement, c1Element]);

      // Assertions to check the visibility
      expect(c1Element.getAttribute('aria-hidden')).toBeNull();
      expect(modalElement.getAttribute('aria-hidden')).toBeNull();

      // Parents of the modal and C1 should be visible
      expect(shadowHostC4.getAttribute('aria-hidden')).toBeNull();
      expect(document.getElementById('P1').getAttribute('aria-hidden')).toBeNull();
      expect(document.getElementById('P2').getAttribute('aria-hidden')).toBeNull();

      // Siblings and other elements should be hidden
      expect(document.getElementById('C2').getAttribute('aria-hidden')).toBe('true');
      expect(shadowHostC3.getAttribute('aria-hidden')).toBe('true');
      expect(shadowRootC4.querySelector('#C5').getAttribute('aria-hidden')).toBe('true');
    });

    it('should handle input and popup pattern in shadow DOM', () => {
      // Set up the initial DOM with shadow hosts and content
      document.body.innerHTML = `
    <div id="P1">
      <div id="C1"></div>
      <div id="C2"></div>
    </div>
    <div id="P2">
      <div id="C3"></div>
      <div id="C4"></div>
    </div>
  `;

      // Create a shadow root that will contain both our input and overlay
      const shadowHostC4 = document.querySelector('#C4');
      const shadowRootC4 = shadowHostC4.attachShadow({mode: 'open'});
      shadowRootC4.innerHTML = `
    <div class="content-container-2"></div>
    <div class="content-container">
      <input type="text" id="input" />
    </div>
    <div class="overlay-portal">
      <div id="popup">Popup</div>
    </div>
  `;

      // Get our target elements (input and popup) that should remain visible
      const inputElement = shadowRootC4.querySelector('#input');
      const popupElement = shadowRootC4.querySelector('#popup');

      // Call ariaHideOutside with both the input and popup as targets
      cleanup = ariaHideOutside([inputElement, popupElement]);

      // Input and popup should remain visible
      expect(inputElement.getAttribute('aria-hidden')).toBeNull();
      expect(popupElement.getAttribute('aria-hidden')).toBeNull();

      // Their direct containers should remain visible
      expect(
        shadowRootC4.querySelector('.content-container').getAttribute('aria-hidden')
      ).toBeNull();
      expect(shadowRootC4.querySelector('.overlay-portal').getAttribute('aria-hidden')).toBeNull();

      // The unrelated container should be hidden
      expect(shadowRootC4.querySelector('.content-container-2').getAttribute('aria-hidden')).toBe(
        'true'
      );

      // Shadow host and its parent should be visible since they contain our targets
      expect(shadowHostC4.getAttribute('aria-hidden')).toBeNull();
      expect(document.getElementById('P2').getAttribute('aria-hidden')).toBeNull();
    });
  });
});


describe('ariaHideOutside with shadow DOM: extra cases', function () {
  beforeAll(() => {
    enableShadowDOM();
  });

  let cleanup;
  afterEach(async () => {
    cleanup?.();
    cleanup = undefined;
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    await act(async () => Promise.resolve());
  });

  let tick = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));

  function nested() {
    let outerHost = document.createElement('div');
    document.body.appendChild(outerHost);
    let outer = outerHost.attachShadow({mode: 'open'});
    let innerHost = document.createElement('div');
    outer.appendChild(innerHost);
    let inner = innerHost.attachShadow({mode: 'open'});
    let modal = document.createElement('div');
    modal.setAttribute('role', 'dialog');
    inner.appendChild(modal);
    let innerSibling = document.createElement('div');
    inner.appendChild(innerSibling);
    let outerSibling = document.createElement('div');
    outer.appendChild(outerSibling);
    let lightSibling = document.createElement('div');
    document.body.appendChild(lightSibling);
    return {outerHost, outer, innerHost, inner, modal, innerSibling, outerSibling, lightSibling};
  }

  it('hides content added later to an enclosing shadow root, not just the target\'s own', async () => {
    let {outer, inner, modal, outerHost, innerHost} = nested();
    cleanup = ariaHideOutside([modal]);

    let lateOuter = document.createElement('div');
    outer.appendChild(lateOuter);
    let lateInner = document.createElement('div');
    inner.appendChild(lateInner);
    await tick();

    expect(lateOuter.getAttribute('aria-hidden')).toBe('true');
    expect(lateInner.getAttribute('aria-hidden')).toBe('true');
    expect(modal.getAttribute('aria-hidden')).toBeNull();
    expect(outerHost.getAttribute('aria-hidden')).toBeNull();
    expect(innerHost.getAttribute('aria-hidden')).toBeNull();
  });

  it('hides siblings at every level of nesting, and keeps the path to the target visible', () => {
    let {outerHost, innerHost, modal, innerSibling, outerSibling, lightSibling} = nested();
    cleanup = ariaHideOutside([modal]);

    expect(innerSibling.getAttribute('aria-hidden')).toBe('true');
    expect(outerSibling.getAttribute('aria-hidden')).toBe('true');
    expect(lightSibling.getAttribute('aria-hidden')).toBe('true');
    expect(outerHost.getAttribute('aria-hidden')).toBeNull();
    expect(innerHost.getAttribute('aria-hidden')).toBeNull();
    expect(modal.getAttribute('aria-hidden')).toBeNull();
  });

  it('restores everything on revert, and stops hiding new content after revert', async () => {
    let {outer, inner, modal, innerSibling, outerSibling, lightSibling} = nested();
    let revert = ariaHideOutside([modal]);
    revert();

    for (let el of [innerSibling, outerSibling, lightSibling]) {
      expect(el.hasAttribute('aria-hidden')).toBe(false);
    }

    let lateOuter = document.createElement('div');
    outer.appendChild(lateOuter);
    let lateInner = document.createElement('div');
    inner.appendChild(lateInner);
    let lateLight = document.createElement('div');
    document.body.appendChild(lateLight);
    await tick();

    for (let el of [lateOuter, lateInner, lateLight]) {
      expect(el.hasAttribute('aria-hidden')).toBe(false);
    }
  });

  it('keeps an input and its popover visible when they live in different shadow roots', () => {
    let inputHost = document.createElement('div');
    document.body.appendChild(inputHost);
    let inputRoot = inputHost.attachShadow({mode: 'open'});
    inputRoot.innerHTML = '<label>Name</label><input id="input" /><span id="hint">hint</span>';

    let portalHost = document.createElement('div');
    document.body.appendChild(portalHost);
    let portalRoot = portalHost.attachShadow({mode: 'open'});
    portalRoot.innerHTML = '<div id="popover" role="listbox"><div role="option">One</div></div><div id="other">other</div>';

    let unrelated = document.createElement('main');
    document.body.appendChild(unrelated);

    let input = inputRoot.getElementById('input');
    let popover = portalRoot.getElementById('popover');
    cleanup = ariaHideOutside([input, popover]);

    expect(input.getAttribute('aria-hidden')).toBeNull();
    expect(popover.getAttribute('aria-hidden')).toBeNull();
    expect(inputHost.getAttribute('aria-hidden')).toBeNull();
    expect(portalHost.getAttribute('aria-hidden')).toBeNull();
    expect(inputRoot.getElementById('hint').getAttribute('aria-hidden')).toBe('true');
    expect(portalRoot.getElementById('other').getAttribute('aria-hidden')).toBe('true');
    expect(unrelated.getAttribute('aria-hidden')).toBe('true');
  });

  it('keeps a live announcer added inside an enclosing shadow root visible', async () => {
    let {outer, modal} = nested();
    cleanup = ariaHideOutside([modal]);

    let announcer = document.createElement('div');
    announcer.setAttribute('data-live-announcer', 'true');
    outer.appendChild(announcer);
    await tick();

    expect(announcer.getAttribute('aria-hidden')).toBeNull();
  });
});
