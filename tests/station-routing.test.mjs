import test from 'node:test'
import assert from 'node:assert/strict'
import { businessTemplate } from '../src/lib/businessTemplates.ts'
import { defaultStationNameForCategory, defaultStationsForStore, resolveProductStationId } from '../src/lib/stations.ts'

test('default stations and product routing send drinks to Bar, food to Kitchen, and water nowhere', () => {
  const stations = defaultStationsForStore('store')
  const barId = stations.find((station) => station.name === 'Bar').id
  const kitchenId = stations.find((station) => station.name === 'Kitchen').id

  assert.deepEqual(stations.map((station) => station.name), ['Kitchen', 'Bar'])
  const coffeeCategoryStation = defaultStationNameForCategory('Coffee') === 'Bar' ? barId : undefined
  assert.equal(resolveProductStationId('Coffee', undefined, coffeeCategoryStation), barId)
  const pastryCategoryStation = defaultStationNameForCategory('Pastries') === 'Kitchen' ? kitchenId : undefined
  assert.equal(resolveProductStationId('Pastry', undefined, pastryCategoryStation), kitchenId)
  assert.equal(resolveProductStationId('Bottled water', undefined, barId), null)
  assert.equal(resolveProductStationId('Bottled water', null, barId), null)
})

test('business templates carry station routing defaults', () => {
  const cafe = businessTemplate('cafe')
  const categoryStation = (name) => cafe.categories.find((category) => category.name === name)?.station
  const restaurant = businessTemplate('restaurant')
  const restaurantStation = (name) => restaurant.categories.find((category) => category.name === name)?.station

  assert.equal(categoryStation('Coffee'), 'Bar')
  assert.equal(categoryStation('Pastries'), 'Kitchen')
  assert.equal(restaurantStation('Main courses'), 'Kitchen')
  assert.equal(restaurantStation('Drinks'), 'Bar')
  assert.equal(businessTemplate('retail').categories.find((category) => category.name === 'Groceries').station, undefined)
})
