import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import maplibregl, { Map, GeoJSONSource } from 'maplibre-gl'
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart, Legend } from 'recharts'

type ScenarioParams = {
  months: number
  birthRate: number
  deathRate: number
  migrationNet: number
  employmentShock: number
  peopleProps: PeopleProperties
  peopleActions: PeopleActions
  orgActions: OrgActions
}

type TimePoint = {
  t: number
  population: number
  employed: number
  unemployed: number
  migration: number
}

type PeopleProperties = {
  careerOrientation: number
  openness: number
  stress: number
  skills: number
  memory: number
  socialNorms: number
  incomeThousand: number
  savingsThousand: number
  fatigue: number
  illness: number
}

type PeopleActions = {
  jobSearchProb: number
  hireProb: number
  quitProb: number
  migrateProb: number
  trainingRate: number
  educationRate: number
  retireAge: number
  meetRate: number
  pairCreateRate: number
  marryRate: number
  divorceRate: number
  birthRateAdj: number
  deathRateAdj: number
}

type OrgActions = {
  hireRate: number
  fireRate: number
  wageIndex: number
  hoursIndex: number
}

function simulate(params: ScenarioParams): TimePoint[] {
  const { months, birthRate, deathRate, migrationNet, employmentShock, peopleProps, peopleActions, orgActions } = params
  const result: TimePoint[] = []
  let population = 146_000_000
  let employedShare = 0.60

  for (let t = 0; t < months; t += 1) {
    const effectiveBirthRate = birthRate * (1 + peopleActions.birthRateAdj + 0.1 * (peopleActions.pairCreateRate + peopleActions.marryRate) - 0.05 * peopleActions.divorceRate)
    const effectiveDeathRate = deathRate * (1 + peopleActions.deathRateAdj + 0.5 * peopleProps.illness)
    const births = (effectiveBirthRate / 12) * population
    const deaths = (effectiveDeathRate / 12) * population
    const migFactor = 1 + (peopleActions.migrateProb - 0.5) * 0.5 + (orgActions.wageIndex - 1) * 0.3
    const migration = (migrationNet / 12) * migFactor

    population = population + births - deaths + migration

    // simple employment shock oscillation
    const shock = employmentShock * Math.sin((2 * Math.PI * t) / 12)
    employedShare = employedShare
      + shock
      + 0.02 * (peopleProps.skills - 0.5)
      + 0.01 * (peopleActions.jobSearchProb - 0.5)
      - 0.01 * (peopleActions.quitProb - 0.5)
      + 0.01 * (orgActions.hireRate - orgActions.fireRate)
      + 0.003 * ((orgActions.wageIndex - 1) + (orgActions.hoursIndex - 1))
      - 0.02 * (peopleProps.fatigue + peopleProps.illness - 1.0)
    employedShare -= Math.max(0, (65 - peopleActions.retireAge)) * 0.002
    employedShare = Math.max(0.45, Math.min(0.7, employedShare))

    const employed = population * employedShare
    const unemployed = Math.max(0, population * 0.68 - employed)

    result.push({ t, population: Math.round(population), employed: Math.round(employed), unemployed: Math.round(unemployed), migration: Math.round(migration) })
  }

  return result
}

function useMap(containerId: string) {
  const mapRef = useRef<Map | null>(null)

  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerId,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [90, 62],
      zoom: 2.5,
    })
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }))
    map.on('load', () => {
      // Обзор на Россию
      map.fitBounds([
        [19.0, 41.0], // юго-запад
        [191.0, 82.0], // северо-восток
      ], { padding: 20, duration: 0 })
    })
    mapRef.current = map
    return () => map.remove()
  }, [containerId])

  return mapRef
}

function App() {
  const [params, setParams] = useState<ScenarioParams>({
    months: 36,
    birthRate: 0.011,
    deathRate: 0.013,
    migrationNet: 150_000,
    employmentShock: 0.001,
    peopleProps: {
      careerOrientation: 0.6,
      openness: 0.5,
      stress: 0.4,
      skills: 0.6,
      memory: 0.5,
      socialNorms: 0.7,
      incomeThousand: 60,
      savingsThousand: 300,
      fatigue: 0.3,
      illness: 0.2,
    },
    peopleActions: {
      jobSearchProb: 0.5,
      hireProb: 0.3,
      quitProb: 0.2,
      migrateProb: 0.2,
      trainingRate: 0.1,
      educationRate: 0.05,
      retireAge: 64,
      meetRate: 0.2,
      pairCreateRate: 0.15,
      marryRate: 0.12,
      divorceRate: 0.05,
      birthRateAdj: 0.0,
      deathRateAdj: 0.0,
    },
    orgActions: {
      hireRate: 0.25,
      fireRate: 0.15,
      wageIndex: 1.0,
      hoursIndex: 1.0,
    },
  })
  const data = useMemo(() => simulate(params), [params])

  const mapRef = useMap('map')

  // Набор крупных городов как объекты визуализации
  const cities = useMemo(() => [
    { name: 'Москва', coords: [37.6176, 55.7558], pop: 12_600_000 },
    { name: 'Санкт‑Петербург', coords: [30.3158, 59.9391], pop: 5_600_000 },
    { name: 'Новосибирск', coords: [82.9346, 55.0084], pop: 1_620_000 },
    { name: 'Екатеринбург', coords: [60.6122, 56.8389], pop: 1_550_000 },
    { name: 'Казань', coords: [49.1064, 55.7963], pop: 1_350_000 },
    { name: 'Нижний Новгород', coords: [44.002, 56.3269], pop: 1_250_000 },
    { name: 'Самара', coords: [50.15, 53.2], pop: 1_160_000 },
    { name: 'Омск', coords: [73.3686, 54.9914], pop: 1_120_000 },
    { name: 'Ростов‑на‑Дону', coords: [39.7015, 47.2357], pop: 1_130_000 },
    { name: 'Уфа', coords: [55.9678, 54.7388], pop: 1_130_000 },
    { name: 'Красноярск', coords: [92.868, 56.0153], pop: 1_100_000 },
  ], [])

  const cityCollection = useMemo(() => {
    const last = data[data.length - 1]
    const prev = data[Math.max(0, data.length - 2)]
    const totalBase = cities.reduce((s, c) => s + c.pop, 0)
    const employedDelta = last.employed - prev.employed
    return {
      type: 'FeatureCollection',
      features: cities.map((c) => ({
        type: 'Feature',
        properties: {
          name: c.name,
          value: Math.round((c.pop / totalBase) * last.employed),
          growth: Math.round((c.pop / totalBase) * employedDelta),
        },
        geometry: { type: 'Point', coordinates: c.coords },
      })),
    } as GeoJSON.FeatureCollection
  }, [cities, data])

  // Добавляем/обновляем слой объектов на карте
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const ensureLayers = () => {
      if (!map.getSource('cities')) {
        map.addSource('cities', { type: 'geojson', data: cityCollection })
        map.addLayer({
          id: 'cities-circles',
          type: 'circle',
          source: 'cities',
          paint: {
            'circle-radius': [
              'interpolate', ['linear'], ['get', 'value'],
              50_000, 4,
              300_000, 10,
              1_000_000, 16,
              5_000_000, 26
            ],
            'circle-color': [
              'interpolate', ['linear'], ['get', 'growth'],
              -10000, '#ef4444',
              0, '#93c5fd',
              10000, '#16a34a'
            ],
            'circle-opacity': 0.75,
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 1,
          },
        })
        map.addLayer({
          id: 'cities-labels',
          type: 'symbol',
          source: 'cities',
          layout: {
            'text-field': ['format', ['get', 'name'], '\n', ['to-string', ['round', ['/', ['get', 'value'], 1000]]], ' тыс. занятых', '\n', ['to-string', ['round', ['/', ['get', 'growth'], 1000]]], ' тыс. Δ'],
            'text-size': 11,
            'text-offset': [0, 1.2],
            'text-anchor': 'top',
          },
          paint: { 'text-halo-color': '#ffffff', 'text-halo-width': 1 },
        })
      } else {
        ;(map.getSource('cities') as GeoJSONSource).setData(cityCollection)
      }
    }

    if (map.loaded()) ensureLayers()
    else map.on('load', ensureLayers)
  }, [cityCollection, mapRef])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gridTemplateRows: 'minmax(320px, 55vh) minmax(280px, 1fr) auto',
      gridTemplateAreas: "'sidebar map' 'sidebar charts' 'footer footer'", height: '100dvh', gap: 12, padding: 12 }}>
      <aside style={{ gridArea: 'sidebar', borderRight: '1px solid #e5e7eb', paddingRight: 12, minHeight: 0, overflow: 'auto' }}>
        <h2>Параметры сценария</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateRows: 'auto auto', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Месяцев</span>
              <strong>{params.months}</strong>
            </div>
            <input type="range" min={6} max={120} value={params.months} onChange={(e) => setParams({ ...params, months: Number(e.target.value) })} />
          </div>

          <div style={{ display: 'grid', gridTemplateRows: 'auto auto', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Рождаемость (годовая)</span>
              <strong>{params.birthRate.toFixed(3)}</strong>
            </div>
            <input type="range" min={0.005} max={0.02} step={0.0005} value={params.birthRate} onChange={(e) => setParams({ ...params, birthRate: Number(e.target.value) })} />
          </div>

          <div style={{ display: 'grid', gridTemplateRows: 'auto auto', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Смертность (годовая)</span>
              <strong>{params.deathRate.toFixed(3)}</strong>
            </div>
            <input type="range" min={0.005} max={0.02} step={0.0005} value={params.deathRate} onChange={(e) => setParams({ ...params, deathRate: Number(e.target.value) })} />
          </div>

          <div style={{ display: 'grid', gridTemplateRows: 'auto auto', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Чистая миграция / год</span>
              <strong>{params.migrationNet.toLocaleString('ru-RU')}</strong>
            </div>
            <input type="range" min={-500000} max={500000} step={10000} value={params.migrationNet} onChange={(e) => setParams({ ...params, migrationNet: Number(e.target.value) })} />
          </div>

          <div style={{ display: 'grid', gridTemplateRows: 'auto auto', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Шок занятости</span>
              <strong>{params.employmentShock.toFixed(4)}</strong>
            </div>
            <input type="range" min={-0.005} max={0.005} step={0.0005} value={params.employmentShock} onChange={(e) => setParams({ ...params, employmentShock: Number(e.target.value) })} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={async () => {
              try {
                const res = await fetch('/data/policy.json')
                const json = await res.json()
                setParams(p => ({
                  ...p,
                  ...json,
                  peopleProps: (json as any).peopleProps ?? p.peopleProps,
                  peopleActions: (json as any).peopleActions ?? p.peopleActions,
                  orgActions: (json as any).orgActions ?? p.orgActions,
                }))
                localStorage.setItem('policy', JSON.stringify(json))
              } catch {}
            }}>Загрузить policy.json</button>
            <button onClick={() => {
              localStorage.setItem('policy', JSON.stringify(params))
            }}>Сохранить настройки</button>
            <button onClick={() => {
              const saved = localStorage.getItem('policy')
              if (saved) {
                const json = JSON.parse(saved)
                setParams(p => ({
                  ...p,
                  ...json,
                  peopleProps: json.peopleProps ?? p.peopleProps,
                  peopleActions: json.peopleActions ?? p.peopleActions,
                  orgActions: json.orgActions ?? p.orgActions,
                }))
              }
            }}>Загрузить настройки</button>
          </div>

          {/* Свойства агентов-людей */}
          <h3>Свойства людей</h3>
          {[
            ['Ориентация на карьеру', 'careerOrientation', 0, 1, 0.01],
            ['Открытость/экстраверсия', 'openness', 0, 1, 0.01],
            ['Стресс', 'stress', 0, 1, 0.01],
            ['Навыки', 'skills', 0, 1, 0.01],
            ['Память/опыт', 'memory', 0, 1, 0.01],
            ['Соблюдение норм', 'socialNorms', 0, 1, 0.01],
            ['Усталость', 'fatigue', 0, 1, 0.01],
            ['Болезнь', 'illness', 0, 1, 0.01],
          ].map(([label, key, min, max, step]) => (
            <div key={key as string} style={{ display: 'grid', gridTemplateRows: 'auto auto', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{label as string}</span>
                <strong>{(params.peopleProps as any)[key as string].toFixed ? (params.peopleProps as any)[key as string].toFixed(2) : (params.peopleProps as any)[key as string]}</strong>
              </div>
              <input type="range" min={min as number} max={max as number} step={step as number} value={(params.peopleProps as any)[key as string]} onChange={(e) => setParams({ ...params, peopleProps: { ...params.peopleProps, [key as string]: Number(e.target.value) } })} />
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateRows: 'auto auto', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Доход (тыс/мес)</span>
              <strong>{params.peopleProps.incomeThousand}</strong>
            </div>
            <input type="range" min={10} max={300} step={5} value={params.peopleProps.incomeThousand} onChange={(e) => setParams({ ...params, peopleProps: { ...params.peopleProps, incomeThousand: Number(e.target.value) } })} />
          </div>
          <div style={{ display: 'grid', gridTemplateRows: 'auto auto', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Сбережения (тыс)</span>
              <strong>{params.peopleProps.savingsThousand}</strong>
            </div>
            <input type="range" min={0} max={2000} step={50} value={params.peopleProps.savingsThousand} onChange={(e) => setParams({ ...params, peopleProps: { ...params.peopleProps, savingsThousand: Number(e.target.value) } })} />
          </div>

          {/* Действия людей */}
          <h3>Действия людей (вероятности/мес)</h3>
          {[
            ['Искать работу', 'jobSearchProb'],
            ['Устроиться на работу', 'hireProb'],
            ['Уволиться', 'quitProb'],
            ['Переехать (миграция)', 'migrateProb'],
            ['Курсы повышения квалификации', 'trainingRate'],
            ['Получить образование', 'educationRate'],
            ['Познакомиться', 'meetRate'],
            ['Создать пару', 'pairCreateRate'],
            ['Жениться/выйти замуж', 'marryRate'],
            ['Развестись', 'divorceRate'],
          ].map(([label, key]) => (
            <div key={key as string} style={{ display: 'grid', gridTemplateRows: 'auto auto', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{label as string}</span>
                <strong>{(params.peopleActions as any)[key as string].toFixed(2)}</strong>
              </div>
              <input type="range" min={0} max={1} step={0.01} value={(params.peopleActions as any)[key as string]} onChange={(e) => setParams({ ...params, peopleActions: { ...params.peopleActions, [key as string]: Number(e.target.value) } })} />
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateRows: 'auto auto', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Пенсионный возраст</span>
              <strong>{params.peopleActions.retireAge}</strong>
            </div>
            <input type="range" min={55} max={68} step={1} value={params.peopleActions.retireAge} onChange={(e) => setParams({ ...params, peopleActions: { ...params.peopleActions, retireAge: Number(e.target.value) } })} />
          </div>
          <div style={{ display: 'grid', gridTemplateRows: 'auto auto', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Модификатор рождаемости</span>
              <strong>{params.peopleActions.birthRateAdj.toFixed(2)}</strong>
            </div>
            <input type="range" min={-0.5} max={0.5} step={0.01} value={params.peopleActions.birthRateAdj} onChange={(e) => setParams({ ...params, peopleActions: { ...params.peopleActions, birthRateAdj: Number(e.target.value) } })} />
          </div>
          <div style={{ display: 'grid', gridTemplateRows: 'auto auto', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Модификатор смертности</span>
              <strong>{params.peopleActions.deathRateAdj.toFixed(2)}</strong>
            </div>
            <input type="range" min={-0.5} max={0.5} step={0.01} value={params.peopleActions.deathRateAdj} onChange={(e) => setParams({ ...params, peopleActions: { ...params.peopleActions, deathRateAdj: Number(e.target.value) } })} />
          </div>

          {/* Организации */}
          <h3>Действия организаций</h3>
          <div style={{ display: 'grid', gridTemplateRows: 'auto auto', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Найм (доля/мес)</span>
              <strong>{params.orgActions.hireRate.toFixed(2)}</strong>
            </div>
            <input type="range" min={0} max={1} step={0.01} value={params.orgActions.hireRate} onChange={(e) => setParams({ ...params, orgActions: { ...params.orgActions, hireRate: Number(e.target.value) } })} />
          </div>
          <div style={{ display: 'grid', gridTemplateRows: 'auto auto', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Увольнения (доля/мес)</span>
              <strong>{params.orgActions.fireRate.toFixed(2)}</strong>
            </div>
            <input type="range" min={0} max={1} step={0.01} value={params.orgActions.fireRate} onChange={(e) => setParams({ ...params, orgActions: { ...params.orgActions, fireRate: Number(e.target.value) } })} />
          </div>
          <div style={{ display: 'grid', gridTemplateRows: 'auto auto', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Индекс зарплат</span>
              <strong>{params.orgActions.wageIndex.toFixed(2)}</strong>
            </div>
            <input type="range" min={0.5} max={1.5} step={0.01} value={params.orgActions.wageIndex} onChange={(e) => setParams({ ...params, orgActions: { ...params.orgActions, wageIndex: Number(e.target.value) } })} />
          </div>
          <div style={{ display: 'grid', gridTemplateRows: 'auto auto', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Индекс рабочего времени</span>
              <strong>{params.orgActions.hoursIndex.toFixed(2)}</strong>
            </div>
            <input type="range" min={0.5} max={1.5} step={0.01} value={params.orgActions.hoursIndex} onChange={(e) => setParams({ ...params, orgActions: { ...params.orgActions, hoursIndex: Number(e.target.value) } })} />
          </div>
        </div>
      </aside>

      <main style={{ gridArea: 'map', display: 'grid', gridTemplateRows: '1fr', gap: 12, minHeight: 0 }}>
        <div id="map" style={{ width: '100%', height: '100%', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb' }} />
      </main>

      {/* Charts row spanning full width */}
      <div style={{ gridArea: 'charts', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, minHeight: 0 }}>
          <div style={{ height: '100%', border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, minHeight: 0 }}>
            <h3>Население и занятость</h3>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="pop" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#eee" />
                <XAxis dataKey="t" tickFormatter={(v) => `${v}м`} />
                <YAxis tickFormatter={(v) => (v / 1_000_000).toFixed(0) + 'м'} />
                <Tooltip formatter={(v: number) => v.toLocaleString('ru-RU')} labelFormatter={(v) => `Месяц ${v}`} />
                <Legend />
                <Area type="monotone" dataKey="population" stroke="#6366f1" fillOpacity={1} fill="url(#pop)" name="население" />
                <Line type="monotone" dataKey="employed" stroke="#16a34a" name="занятые" />
                <Line type="monotone" dataKey="unemployed" stroke="#ef4444" name="безработные" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div style={{ height: '100%', border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, minHeight: 0 }}>
            <h3>Миграция (чистая, помесячно)</h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button onClick={() => {
                const header = 't,population,employed,unemployed,migration\n'
                const rows = data.map(d => `${d.t},${d.population},${d.employed},${d.unemployed},${d.migration}`).join('\n')
                const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'simulation.csv'
                a.click()
                URL.revokeObjectURL(url)
              }}>Экспорт CSV</button>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid stroke="#eee" />
                <XAxis dataKey="t" tickFormatter={(v) => `${v}м`} />
                <YAxis tickFormatter={(v) => v.toLocaleString('ru-RU')} />
                <Tooltip formatter={(v: number) => v.toLocaleString('ru-RU')} labelFormatter={(v) => `Месяц ${v}`} />
                <Line type="monotone" dataKey="migration" stroke="#0ea5e9" name="миграция" />
              </LineChart>
            </ResponsiveContainer>
      </div>
      </div>

      {/* Architecture section */}
      <section style={{ gridArea: 'footer', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
        <h3>Прототип архитектуры информационной системы</h3>
        <svg width="100%" viewBox="0 0 1300 560" role="img" aria-label="Архитектурная схема" style={{ background: '#ffffff' }}>
          <defs>
            <marker id="arrow" markerWidth="10" markerHeight="8" refX="8" refY="4" orient="auto">
              <path d="M0,0 L10,4 L0,8 z" fill="#425472"></path>
            </marker>
          </defs>
          <rect x="20" y="30" width="320" height="80" fill="#eff6ff" stroke="#93c5fd" rx="10"></rect>
          <text x="35" y="55" fontSize="16">Источники данных</text>
          <text x="35" y="78" fontSize="14">Росстат / ЕМИСС / ВПО-1,2 / Открытые ГИС</text>

          <rect x="360" y="30" width="260" height="80" fill="#eff6ff" stroke="#93c5fd" rx="10"></rect>
          <text x="375" y="55" fontSize="16">ETL/ELT конвейер</text>
          <text x="375" y="78" fontSize="14">Загрузка, очистка, нормализация</text>

          <rect x="660" y="30" width="300" height="80" fill="#eff6ff" stroke="#93c5fd" rx="10"></rect>
          <text x="675" y="55" fontSize="16">Хранилище данных</text>
          <text x="675" y="78" fontSize="14">PostgreSQL + PostGIS / Data Lake</text>

          <rect x="1000" y="30" width="280" height="80" fill="#eff6ff" stroke="#93c5fd" rx="10"></rect>
          <text x="1015" y="55" fontSize="16">Слои признаков/агрегаций</text>
          <text x="1015" y="78" fontSize="14">Подготовка входов для модели</text>

          <rect x="130" y="180" width="300" height="100" fill="#ecfeff" stroke="#67e8f9" rx="10"></rect>
          <text x="145" y="205" fontSize="16">Агентное ядро</text>
          <text x="145" y="227" fontSize="14">Агенты-люди/организации, цикл тиков</text>

          <rect x="480" y="180" width="260" height="100" fill="#ecfeff" stroke="#67e8f9" rx="10"></rect>
          <text x="495" y="205" fontSize="16">Калибровка/валидация</text>
          <text x="495" y="227" fontSize="14">Баес/корреляции, подбор параметров</text>

          <rect x="780" y="180" width="220" height="100" fill="#ecfeff" stroke="#67e8f9" rx="10"></rect>
          <text x="795" y="205" fontSize="16">Сценарный модуль</text>
          <text x="795" y="227" fontSize="14">Политики, варианты входов</text>

          <rect x="1040" y="180" width="180" height="100" fill="#ecfeff" stroke="#67e8f9" rx="10"></rect>
          <text x="1055" y="205" fontSize="16">API сервиса</text>
          <text x="1055" y="227" fontSize="14">REST/GraphQL</text>

          <rect x="120" y="330" width="300" height="100" fill="#f0fdf4" stroke="#86efac" rx="10"></rect>
          <text x="135" y="355" fontSize="16">Веб-интерфейс</text>
          <text x="135" y="377" fontSize="14">Карта, графики, отчёты</text>

          <rect x="480" y="330" width="260" height="100" fill="#f0fdf4" stroke="#86efac" rx="10"></rect>
          <text x="495" y="355" fontSize="16">Экспорт результатов</text>
          <text x="495" y="377" fontSize="14">CSV / Excel / GeoJSON</text>

          <rect x="780" y="330" width="240" height="100" fill="#f0fdf4" stroke="#86efac" rx="10"></rect>
          <text x="795" y="355" fontSize="16">Мониторинг/логирование</text>
          <text x="795" y="377" fontSize="14">Метрики, трейсинг</text>

          <rect x="1060" y="330" width="180" height="100" fill="#f0fdf4" stroke="#86efac" rx="10"></rect>
          <text x="1075" y="355" fontSize="16">Безопасность</text>
          <text x="1075" y="377" fontSize="14">Доступы, аудит</text>

          <path d="M340,70 L360,70" stroke="#425472" strokeWidth="1.4" fill="none" markerEnd="url(#arrow)" />
          <path d="M620,70 L660,70" stroke="#425472" strokeWidth="1.4" fill="none" markerEnd="url(#arrow)" />
          <path d="M960,70 L1000,70" stroke="#425472" strokeWidth="1.4" fill="none" markerEnd="url(#arrow)" />

          <path d="M810,110 L280,180" stroke="#425472" strokeWidth="1.4" fill="none" markerEnd="url(#arrow)" />
          <path d="M810,110 L610,180" stroke="#425472" strokeWidth="1.4" fill="none" markerEnd="url(#arrow)" />
          <path d="M810,110 L890,180" stroke="#425472" strokeWidth="1.4" fill="none" markerEnd="url(#arrow)" />
          <path d="M810,110 L1130,180" stroke="#425472" strokeWidth="1.4" fill="none" markerEnd="url(#arrow)" />

          <path d="M280,280 L270,330" stroke="#425472" strokeWidth="1.4" fill="none" markerEnd="url(#arrow)" />
          <path d="M610,280 L610,330" stroke="#425472" strokeWidth="1.4" fill="none" markerEnd="url(#arrow)" />
          <path d="M890,280 L900,330" stroke="#425472" strokeWidth="1.4" fill="none" markerEnd="url(#arrow)" />
          <path d="M1130,280 L1150,330" stroke="#425472" strokeWidth="1.4" fill="none" markerEnd="url(#arrow)" />

          <path d="M890,230 L1130,230" stroke="#425472" strokeWidth="1.4" fill="none" markerEnd="url(#arrow)" />
          <path d="M1130,230 L610,360" stroke="#425472" strokeWidth="1.4" fill="none" markerEnd="url(#arrow)" />
        </svg>
        <p style={{ color: '#6b7280', fontSize: 12 }}>Схема отражает: источники → ETL → хранилище/фичи → агентное ядро + калибровка/сценарии → API → UI/экспорт, с мониторингом и безопасностью.</p>
      </section>

      <footer style={{ gridColumn: '1 / span 2', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
        <div>Агентная модель — прототип. Демо визуализации и параметров сценария.</div>
        <div>Экспорт CSV скоро добавлю</div>
      </footer>
    </div>
  )
}

export default App
