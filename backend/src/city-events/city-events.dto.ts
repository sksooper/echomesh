import { IsIn, IsOptional } from 'class-validator';

export class ListEventsQuery {
  /** current = niezakończone (trwające + zaplanowane), active = tylko trwające, all = także zakończone */
  @IsOptional()
  @IsIn(['current', 'active', 'all'])
  scope?: 'current' | 'active' | 'all' = 'current';
}
