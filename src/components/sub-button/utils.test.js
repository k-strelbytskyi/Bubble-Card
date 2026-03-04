import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const getRenderedTemplateMock = jest.fn();
const stopElementTimerIntervalMock = jest.fn();
const getIconMock = jest.fn(() => 'mdi:entity');

jest.unstable_mockModule('../../tools/utils.js', () => ({
  getAttribute: jest.fn((context, attribute, entity = context.config.entity) => {
    return context._hass.states[entity]?.attributes?.[attribute] ?? '';
  }),
  isStateOn: jest.fn(() => false),
  isStateRequiringAttention: jest.fn(() => false),
  formatDateTime: jest.fn(() => '1 hour ago'),
  createElement: jest.fn(() => ({ classList: { add: jest.fn() } })),
  getStateSurfaceColor: jest.fn(() => 'rgb(0, 0, 0)'),
  getState: jest.fn((context, entity = context.config.entity) => context._hass.states[entity]?.state ?? ''),
  isTimerEntity: jest.fn(() => false),
  timerTimeRemaining: jest.fn(() => 0),
  computeDisplayTimer: jest.fn(() => '0:00'),
  startElementTimerInterval: jest.fn(),
  stopElementTimerInterval: stopElementTimerIntervalMock,
  formatNumericValue: jest.fn((value, decimals, unit) => `${Number(value).toFixed(decimals)} ${unit}`.trim()),
  getTemperatureUnit: jest.fn(() => '°C'),
}));

jest.unstable_mockModule('../../tools/icon.js', () => ({
  getIcon: getIconMock,
  getLightColorSignature: jest.fn(() => ''),
  getImage: jest.fn(() => ''),
}));

jest.unstable_mockModule('../../tools/tap-actions.js', () => ({
  addActions: jest.fn(),
  addFeedback: jest.fn(),
}));

jest.unstable_mockModule('../../tools/validate-condition.js', () => ({
  checkConditionsMet: jest.fn(() => true),
  validateConditionalConfig: jest.fn(() => true),
  ensureArray: jest.fn((value) => (Array.isArray(value) ? value : [value])),
}));

jest.unstable_mockModule('../../tools/text-scrolling.js', () => ({
  applyScrollingEffect: jest.fn(),
}));

jest.unstable_mockModule('../../tools/render-template.js', () => ({
  getRenderedTemplate: getRenderedTemplateMock,
}));

const { getSubButtonOptions, buildDisplayedState } = await import('./utils.js');

function createContext() {
  return {
    config: { entity: 'sensor.parent' },
    _hass: {
      states: {
        'sensor.test': {
          state: 'on',
          attributes: {
            friendly_name: 'Default Friendly Name',
          },
          last_changed: '2024-01-01T00:00:00.000Z',
          last_updated: '2024-01-01T00:00:00.000Z',
        },
      },
      formatEntityState: jest.fn(() => 'Formatted State'),
      formatEntityAttributeValue: jest.fn(() => 'Formatted Attribute'),
      locale: { language: 'en-US' },
      config: { unit_system: { temperature: '°C', length: 'km' } },
    },
  };
}

describe('sub-button native template overrides', () => {
  beforeEach(() => {
    getRenderedTemplateMock.mockReset();
    stopElementTimerIntervalMock.mockReset();
    getIconMock.mockReset();
    getIconMock.mockReturnValue('mdi:entity');
  });

  test('getSubButtonOptions applies name/icon templates', () => {
    getRenderedTemplateMock.mockImplementation((_, template) => {
      if (template === "{{ 'Templated Name' }}") return 'Templated Name';
      if (template === "{{ 'mdi:weather-sunny' }}") return 'mdi:weather-sunny';
      return undefined;
    });

    const context = createContext();
    const subButton = {
      entity: 'sensor.test',
      name_template: "{{ 'Templated Name' }}",
      icon_template: "{{ 'mdi:weather-sunny' }}",
    };

    const options = getSubButtonOptions(context, subButton, 1);

    expect(options.name).toBe('Templated Name');
    expect(options.icon).toBe('mdi:weather-sunny');
    expect(getIconMock).not.toHaveBeenCalled();
  });

  test('buildDisplayedState uses state_template when available', () => {
    const context = createContext();
    const element = { isConnected: true };
    const displayedState = buildDisplayedState({
      state: context._hass.states['sensor.test'],
      name: 'Label',
      attribute: '',
      attributeType: '',
      showName: true,
      showState: true,
      showAttribute: false,
      showLastChanged: false,
      showLastUpdated: false,
      entity: 'sensor.test',
      renderedStateTemplate: 'Templated State',
    }, context, element);

    expect(displayedState).toBe('Label · Templated State');
    expect(stopElementTimerIntervalMock).toHaveBeenCalledWith(element);
  });

  test('buildDisplayedState falls back to formatted state without template', () => {
    const context = createContext();
    const displayedState = buildDisplayedState({
      state: context._hass.states['sensor.test'],
      name: '',
      attribute: '',
      attributeType: '',
      showName: false,
      showState: true,
      showAttribute: false,
      showLastChanged: false,
      showLastUpdated: false,
      entity: 'sensor.test',
      renderedStateTemplate: undefined,
    }, context);

    expect(displayedState).toBe('Formatted State');
    expect(context._hass.formatEntityState).toHaveBeenCalled();
  });
});
