import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CharacterSnapshotDto } from '../src/characters/dto/character-snapshot.dto';
import { SessionSummaryUploadDto } from '../src/sessions/dto/session-summary.dto';

async function validateDto<T extends object>(cls: new () => T, value: object) {
  const instance = plainToInstance(cls, value);
  return validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
    validationError: { target: false, value: false },
  });
}

describe('DTO validation', () => {
  it('rejects unknown fields on session summary upload', async () => {
    const errors = await validateDto(SessionSummaryUploadDto, {
      sessionId: 'session-123',
      agentType: 'codex',
      workType: 'FEATURE',
      startedAt: new Date().toISOString(),
      durationBucket: 'M_15_30',
      tokenBucket: 'SMALL',
      changedFileCountBucket: 'FEW',
      addedLineBucket: 'FEW',
      deletedLineBucket: 'ONE',
      testRunCount: 1,
      buildRunCount: 0,
      resultStatus: 'SUCCESS',
      expGained: 300,
      statDeltas: { logic: 10 },
      confidence: 'HIGH',
      projectHash: '0123456789abcdef',
      unexpected: true,
    });

    expect(errors.some((error) => error.property === 'unexpected')).toBe(true);
  });

  it('allows tokenBucket and tokenRange fields on session summaries', async () => {
    const errors = await validateDto(SessionSummaryUploadDto, {
      sessionId: 'session-456',
      agentType: 'codex',
      workType: 'FEATURE',
      startedAt: new Date().toISOString(),
      durationBucket: 'M_15_30',
      tokenBucket: 'SMALL',
      tokenRange: { min: 100, max: 500 },
      changedFileCountBucket: 'FEW',
      addedLineBucket: 'FEW',
      deletedLineBucket: 'ONE',
      testRunCount: 1,
      buildRunCount: 0,
      resultStatus: 'SUCCESS',
      expGained: 300,
      statDeltas: { logic: 10 },
      confidence: 'HIGH',
      projectHash: '0123456789abcdef',
    });

    expect(errors).toHaveLength(0);
  });

  it('rejects character snapshot values above safe bounds', async () => {
    const errors = await validateDto(CharacterSnapshotDto, {
      level: 1000,
      exp: 99_999_999,
      class: 'APPRENTICE',
      syncVersion: 1,
      stats: {
        logic: 1,
        debug: 1,
        architecture: 1,
        design: 1,
        stability: 1,
        velocity: 1,
        creativity: 1,
        efficiency: 1,
        stress: 1,
      },
    });

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['level', 'exp']),
    );
  });
});
