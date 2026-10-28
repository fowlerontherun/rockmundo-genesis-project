import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SceneLegacy, isSceneLegacyResponse } from './SceneLegacy';

const city='20000000-0000-0000-0000-000000000071';
const cycle={
  cycle_id:'40000000-0000-0000-0000-000000000071',
  starts_at:'2026-10-12T00:00:00+00:00',
  ends_at:'2026-10-19T00:00:00+00:00',
  target_total:4,
  earned_points:2,
  milestones:[25],
};
const response={city_id:city,cadence:'weekly',cycles:[cycle]};

describe('City Scene Legacy historic community records',()=>{
  it('accepts only bounded, valid and separately verified history',()=>{
    expect(isSceneLegacyResponse(response,city,'weekly')).toBe(true);
    expect(isSceneLegacyResponse({...response,cycles:[]},city,'weekly')).toBe(true);
    expect(isSceneLegacyResponse(response,city,'daily')).toBe(false);
    expect(isSceneLegacyResponse({...response,cycles:[{...cycle,earned_points:-1}]},city,'weekly')).toBe(false);
    expect(isSceneLegacyResponse({...response,cycles:[{...cycle,milestones:[25,25]}]},city,'weekly')).toBe(false);
    expect(isSceneLegacyResponse({...response,cycles:[{...cycle,milestones:[70]}]},city,'weekly')).toBe(false);
    expect(isSceneLegacyResponse({...response,cycles:[{...cycle,ends_at:cycle.starts_at}]},city,'weekly')).toBe(false);
    expect(isSceneLegacyResponse({...response,cycles:Array(25).fill(cycle)},city,'weekly')).toBe(false);
  });

  it('renders separate weekly/daily controls and hides fabricated achievements while loading',()=>{
    const html=renderToStaticMarkup(<SceneLegacy cityId={city} cityName="London" refresh={0}/>);
    expect(html).toContain('Scene Legacy');
    expect(html).toContain('Loading confirmed weekly scene history');
    expect(html).toContain('>daily</button>');
    expect(html).toContain('>weekly</button>');
    expect(html).toContain('verified daily and weekly');
    expect(html).not.toContain('Goal reached');
    expect(html).not.toContain('100 SP');
  });
});
