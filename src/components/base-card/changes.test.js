import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const applyScrollingEffectMock = jest.fn();
const getRenderedTemplateMock = jest.fn();
const startTimerIntervalMock = jest.fn();
const stopTimerIntervalMock = jest.fn();

jest.unstable_mockModule('../../tools/utils.js', () => ({
  formatDateTime: jest.fn(() => '1 hour ago'),
  getState: jest.fn((context, entity = context.config.entity) => context._hass.states[entity]?.state ?? ''),
  getAttribute: jest.fn((context, attribute, entity = context.config.entity) => context._hass.states[entity]?.attributes?.[attribute] ?? ''),
  isEntityType: jest.fn(() => false),
  isStateOn: jest.fn((context, entity = context.config.entity) => {
    const value = context._hass.states[entity]?.state;
    return value === 'on';
  }),
  getName: jest.fn((context) => context.config.name || context._hass.states[context.config.entity]?.attributes?.friendly_name || ''),
  isTimerEntity: jest.fn((entity) => typeof entity === 'string' && entity.startsWith('timer.')),
  timerTimeRemaining: jest.fn(() => 30),
  computeDisplayTimer: jest.fn(() => '0:30'),
  startTimerInterval: startTimerIntervalMock,
  stopTimerInterval: stopTimerIntervalMock,
}));

jest.unstable_mockModule('../../tools/icon.js', () => ({
  getIcon: jest.fn(() => ''),
  getImage: jest.fn(() => ''),
  getIconColor: jest.fn(() => 'var(--primary-color)'),
}));

jest.unstable_mockModule('../../cards/climate/helpers.js', () => ({
  getClimateColor: jest.fn(() => 'var(--primary-color)'),
}));

jest.unstable_mockModule('../../tools/text-scrolling.js', () => ({
  applyScrollingEffect: applyScrollingEffectMock,
}));

jest.unstable_mockModule('../../tools/render-template.js', () => ({
  getRenderedTemplate: getRenderedTemplateMock,
}));

const { changeName, changeState } = await import('./changes.js');

function createClassList() {
  const classes = new Set();
  return {
    add: (...tokens) => tokens.forEach((token) => classes.add(token)),
    remove: (...tokens) => tokens.forEach((token) => classes.delete(token)),
    contains: (token) => classes.has(token),
    toggle: (token, force) => {
      const shouldAdd = force ?? !classes.has(token);
      if (shouldAdd) {
        classes.add(token);
        return true;
      }
      classes.delete(token);
      return false;
    },
  };
}

function createElementStub() {
  return {
    classList: createClassList(),
    innerText: '',
  };
}

function createBaseContext(overrides = {}) {
  const entityId = overrides.config?.entity || 'sensor.test';
  const stateObj = overrides.stateObj || {
    state: 'on',
    attributes: {
      friendly_name: 'Living Room Lamp',
    },
    last_changed: '2024-01-01T00:00:00.000Z',
    last_updated: '2024-01-01T00:00:00.000Z',
  };

  return {
    config: {
      entity: entityId,
      button_type: 'state',
      show_state: true,
      ...(overrides.config || {}),
    },
    _hass: {
      states: {
        [entityId]: stateObj,
      },
      formatEntityState: jest.fn(() => 'Formatted State'),
      formatEntityAttributeValue: jest.fn(() => 'Formatted Attribute'),
      locale: { language: 'en-US' },
      config: { unit_system: { temperature: '°C', length: 'km' } },
      ...(overrides.hass || {}),
    },
    elements: {
      name: createElementStub(),
      iconContainer: createElementStub(),
      nameContainer: createElementStub(),
      state: createElementStub(),
      ...(overrides.elements || {}),
    },
    card: {
      classList: createClassList(),
    },
    ...(overrides.context || {}),
  };
}

describe('base-card template overrides', () => {
  beforeEach(() => {
    applyScrollingEffectMock.mockReset();
    getRenderedTemplateMock.mockReset();
    startTimerIntervalMock.mockReset();
    stopTimerIntervalMock.mockReset();
  });

  test('changeName uses rendered name_template when available', () => {
    getRenderedTemplateMock.mockReturnValue('Templated Name');
    const context = createBaseContext({
      config: {
        button_type: 'switch',
        name_template: "{{ states('sensor.title') }}",
      },
    });

    changeName(context);

    expect(getRenderedTemplateMock).toHaveBeenCalledWith(context._hass, "{{ states('sensor.title') }}");
    expect(applyScrollingEffectMock).toHaveBeenCalledWith(context, context.elements.name, 'Templated Name');
  });

  test('changeName falls back to configured name when template has no result', () => {
    getRenderedTemplateMock.mockReturnValue(undefined);
    const context = createBaseContext({
      config: {
        button_type: 'name',
        name: 'Fallback Name',
        name_template: "{{ states('sensor.empty') }}",
      },
    });

    changeName(context);

    expect(applyScrollingEffectMock).toHaveBeenCalledWith(context, context.elements.name, 'Fallback Name');
  });

  test('changeState uses rendered state_template when available', () => {
    getRenderedTemplateMock.mockReturnValue('Templated State');
    const context = createBaseContext({
      config: {
        show_state: true,
        state_template: "{{ states('sensor.test') | upper }}",
      },
    });

    changeState(context);

    expect(getRenderedTemplateMock).toHaveBeenCalledWith(context._hass, "{{ states('sensor.test') | upper }}");
    expect(applyScrollingEffectMock).toHaveBeenCalledWith(context, context.elements.state, 'Templated State');
  });

  test('changeState falls back to formatted state when template has no result', () => {
    getRenderedTemplateMock.mockReturnValue(undefined);
    const context = createBaseContext({
      config: {
        show_state: true,
        state_template: "{{ states('sensor.test') }}",
      },
    });

    changeState(context);

    expect(context._hass.formatEntityState).toHaveBeenCalled();
    expect(applyScrollingEffectMock).toHaveBeenCalledWith(context, context.elements.state, 'Formatted State');
  });
});
