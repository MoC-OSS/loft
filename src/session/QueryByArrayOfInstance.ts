import { getLogger } from './../Logger';

const l = getLogger('ChatHistoryQueryEngine');

type QueryOperator<T> =
  | { $eq?: T }
  | { $ne?: T }
  | { $gt?: T }
  | { $gte?: T }
  | { $lt?: T }
  | { $lte?: T }
  | { $in?: T[] }
  | { $contains?: string }
  | { $regex?: RegExp };

type Query<T> = {
  [K in keyof T]?: T[K] extends (infer U)[]
    ? QueryOperator<T[K]> | QueryOperator<U>[]
    : QueryOperator<T[K]> | Query<T[K]>;
};

type LogicalQuery<T> = {
  $and?: FullQuery<T>[];
  $or?: FullQuery<T>[];
  $nor?: FullQuery<T>[];
  $not?: FullQuery<T>[];
};

type FullQuery<T> = Query<T> | LogicalQuery<T>;

export abstract class QueryByArrayOfObjects<T> extends Array<T> {
  constructor(...items: T[]) {
    super(...items);
    l.info(`ChatHistoryQueryEngine initialization...`);
  }

  query(query: FullQuery<T>): T[] {
    l.info(`query: ${JSON.stringify(query)}`);
    return this.filter((item) => this.evaluate(item, query));
  }

  private evaluate(item: T, query: FullQuery<T>): boolean {
    if (
      '$and' in query ||
      '$or' in query ||
      '$nor' in query ||
      '$not' in query
    ) {
      const operator = Object.keys(query)[0] as keyof LogicalQuery<T>;
      const values = (query as LogicalQuery<T>)[operator];
      if (!values) return true;
      switch (operator) {
        case '$and':
          return values.every((value) => this.evaluate(item, value));
        case '$or':
          return values.some((value) => this.evaluate(item, value));
        case '$nor':
          return !values.some((value) => this.evaluate(item, value));
        case '$not':
          return !values.every((value) => this.evaluate(item, value));
        default:
          throw new Error(`Invalid operator: ${operator}`);
      }
    } else {
      for (let key in query as Query<T>) {
        const conditions = (query as Query<T>)[key] as
          | QueryOperator<T[keyof T]>
          | Query<T[keyof T]>;
        const fieldValue = item[key as keyof T];
        if (
          '$eq' in conditions ||
          '$ne' in conditions ||
          '$gt' in conditions ||
          '$gte' in conditions ||
          '$lt' in conditions ||
          '$lte' in conditions ||
          '$in' in conditions ||
          '$contains' in conditions ||
          '$regex' in conditions
        ) {
          const opConditions = conditions as QueryOperator<T[keyof T]>;
          for (let op in opConditions) {
            const condition =
              opConditions[op as keyof QueryOperator<T[keyof T]>];
            switch (op) {
              case '$eq':
                if (fieldValue !== condition) return false;
                break;
              case '$ne':
                if (fieldValue === condition) return false;
                break;
              case '$gt':
                if ((fieldValue as any) <= (condition as any)) return false;
                break;
              case '$gte':
                if ((fieldValue as any) < (condition as any)) return false;
                break;
              case '$lt':
                if ((fieldValue as any) >= (condition as any)) return false;
                break;
              case '$lte':
                if ((fieldValue as any) > (condition as any)) return false;
                break;
              case '$in':
                if (!(condition as T[keyof T][]).includes(fieldValue))
                  return false;
                break;
              case '$contains':
                if (
                  typeof fieldValue === 'string' &&
                  fieldValue.indexOf(condition as string) === -1
                )
                  return false;
                break;
              case '$regex':
                if (
                  typeof fieldValue === 'string' &&
                  !(condition as RegExp).test(fieldValue)
                )
                  return false;
                break;
              default:
                throw new Error(`Invalid operator: ${op}`);
            }
          }
        } else if (typeof fieldValue === 'object' && fieldValue !== null) {
          if (!this.evaluate(fieldValue as any, conditions as FullQuery<any>))
            return false;
        }
      }
    }
    return true;
  }

  // fix that prevent call empty constructor when use map, filter, etc.
  static get [Symbol.species]() {
    return Array;
  }
}
