import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  TestMatrixDispositionSchema,
  TestMatrixSchema,
  defaultTestMatrixForIntentType,
  requiredEvidenceTypesForMatrix,
} from '../dist/src/runtime/schemas.js'

test('TestMatrixDispositionSchema accepts the MVP dispositions', () => {
  assert.equal(TestMatrixDispositionSchema.parse('required'), 'required')
  assert.equal(TestMatrixDispositionSchema.parse('optional'), 'optional')
  assert.equal(TestMatrixDispositionSchema.parse('skipped'), 'skipped')
})

test('TestMatrixSchema defaults optional lightweight checks and skipped heavier checks', () => {
  const matrix = TestMatrixSchema.parse({})

  assert.equal(matrix.typecheck, 'optional')
  assert.equal(matrix.build, 'optional')
  assert.equal(matrix.lint, 'optional')
  assert.equal(matrix.unit_test, 'optional')
  assert.equal(matrix.integration_test, 'skipped')
  assert.equal(matrix.e2e_test, 'skipped')
  assert.equal(matrix.custom, 'skipped')
})

test('feature and fix defaults require typecheck and unit tests', () => {
  assert.deepEqual(requiredEvidenceTypesForMatrix(defaultTestMatrixForIntentType('feature')), [
    'typecheck',
    'unit_test',
  ])
  assert.deepEqual(requiredEvidenceTypesForMatrix(defaultTestMatrixForIntentType('fix')), ['typecheck', 'unit_test'])
})

test('tidy defaults require only typecheck and keep unit tests optional', () => {
  const matrix = defaultTestMatrixForIntentType('tidy')

  assert.deepEqual(requiredEvidenceTypesForMatrix(matrix), ['typecheck'])
  assert.equal(matrix.unit_test, 'optional')
  assert.equal(matrix.integration_test, 'skipped')
})

test('chore defaults require typecheck and skip product-level tests', () => {
  const matrix = defaultTestMatrixForIntentType('chore')

  assert.deepEqual(requiredEvidenceTypesForMatrix(matrix), ['typecheck'])
  assert.equal(matrix.unit_test, 'skipped')
  assert.equal(matrix.integration_test, 'skipped')
  assert.equal(matrix.e2e_test, 'skipped')
})
