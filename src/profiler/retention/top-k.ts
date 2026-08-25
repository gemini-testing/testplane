interface HeapEntry<T> {
    score: number;
    value: T;
}

interface TopKAddResult<T> {
    accepted: boolean;
    evicted?: T;
}

export class TopK<T> {
    private readonly _heap: HeapEntry<T>[] = [];

    constructor(private readonly _limit: number) {}

    add(value: T, score: number): TopKAddResult<T> {
        if (this._limit <= 0) {
            return { accepted: false };
        }

        const entry = { value, score };
        if (this._heap.length < this._limit) {
            this._heap.push(entry);
            this._bubbleUp(this._heap.length - 1);
            return { accepted: true };
        }

        if (score <= this._heap[0].score) {
            return { accepted: false };
        }

        const evicted = this._heap[0].value;
        this._heap[0] = entry;
        this._bubbleDown(0);

        return { accepted: true, evicted };
    }

    private _bubbleUp(index: number): void {
        while (index > 0) {
            const parent = Math.floor((index - 1) / 2);
            if (this._heap[parent].score <= this._heap[index].score) {
                return;
            }
            [this._heap[parent], this._heap[index]] = [this._heap[index], this._heap[parent]];
            index = parent;
        }
    }

    private _bubbleDown(index: number): void {
        for (;;) {
            const left = index * 2 + 1;
            const right = left + 1;
            let smallest = index;

            if (left < this._heap.length && this._heap[left].score < this._heap[smallest].score) {
                smallest = left;
            }
            if (right < this._heap.length && this._heap[right].score < this._heap[smallest].score) {
                smallest = right;
            }
            if (smallest === index) {
                return;
            }

            [this._heap[index], this._heap[smallest]] = [this._heap[smallest], this._heap[index]];
            index = smallest;
        }
    }
}
