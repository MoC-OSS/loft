type QueryOperator<T> = {
    $eq?: T;
} | {
    $ne?: T;
} | {
    $gt?: T;
} | {
    $gte?: T;
} | {
    $lt?: T;
} | {
    $lte?: T;
} | {
    $in?: T[];
} | {
    $contains?: string;
} | {
    $regex?: RegExp;
};
type Query<T> = {
    [K in keyof T]?: T[K] extends (infer U)[] ? QueryOperator<T[K]> | QueryOperator<U>[] : QueryOperator<T[K]> | Query<T[K]>;
};
type LogicalQuery<T> = {
    $and?: FullQuery<T>[];
    $or?: FullQuery<T>[];
    $nor?: FullQuery<T>[];
    $not?: FullQuery<T>[];
};
type FullQuery<T> = Query<T> | LogicalQuery<T>;
export declare abstract class QueryByArrayOfObjects<T> extends Array<T> {
    constructor(...items: T[]);
    query(query: FullQuery<T>): T[];
    private evaluate;
    static get [Symbol.species](): ArrayConstructor;
}
export {};
//# sourceMappingURL=QueryByArrayOfInstance.d.ts.map