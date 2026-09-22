// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  resolveInstrumentSkinVisual,
  resolveStageInstrumentSkin,
  sanitizeInstrumentZoneColours,
  type InstrumentSkinItem,
} from './instrumentSkin';

const item: InstrumentSkinItem = {
  id: '11111111-1111-4111-8111-111111111111',
  external_key: 'test-guitar',
  name: 'Test Guitar',
  target_instrument: 'electric_guitar',
  price: 500,
  design_key: 'solid',
  body_color: '#112233',
  secondary_color: '#445566',
  pickguard_color: '#778899',
  hardware_color: '#aabbcc',
  variant_matrix: [
    {
      id: 'stage',
      label: 'Stage',
      designKey: 'lightning',
      bodyColor: '#aa0000',
      secondaryColor: '#00ffff',
      pickguardColor: '#111111',
      hardwareColor: '#dddddd',
    },
  ],
  customization_zones: [
    { id: 'body', name: 'Body', playerEditable: true },
    { id: 'secondary', name: 'Graphic', playerEditable: true },
    { id: 'pickguard', name: 'Pickguard', playerEditable: false },
  ],
};

describe('instrument skin resolution', () => {
  it('combines a catalogue variant with approved player colour overrides', () => {
    expect(resolveInstrumentSkinVisual(item, 'stage', {
      body: '#123456',
      secondary: '#abcdef',
      pickguard: '#ffffff',
      unknown: '#010203',
    })).toEqual({
      itemId: item.id,
      instrumentId: 'electric_guitar',
      designKey: 'lightning',
      bodyColor: '#123456',
      secondaryColor: '#abcdef',
      pickguardColor: '#111111',
      hardwareColor: '#dddddd',
    });
  });

  it('drops invalid or non-editable custom colours before persistence/rendering', () => {
    expect(sanitizeInstrumentZoneColours(item, {
      body: '#ABCDEF',
      secondary: 'red',
      pickguard: '#ffffff',
      hardware: '#010203',
    })).toEqual({ body: '#abcdef' });
  });

  it('resolves the public equipped-stage row without exposing purchase data', () => {
    expect(resolveStageInstrumentSkin({
      profile_id: '22222222-2222-4222-8222-222222222222',
      item_id: item.id,
      instrument_id: 'electric_guitar',
      design_key: 'solid',
      body_color: '#112233',
      secondary_color: '#445566',
      pickguard_color: '#778899',
      hardware_color: '#aabbcc',
      variant_matrix: item.variant_matrix,
      customization_zones: item.customization_zones,
      selected_variant_key: 'stage',
      customization_config: { body: '#654321' },
    })).toMatchObject({
      itemId: item.id,
      instrumentId: 'electric_guitar',
      designKey: 'lightning',
      bodyColor: '#654321',
      secondaryColor: '#00ffff',
    });
  });
});
