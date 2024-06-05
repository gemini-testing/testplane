import { configureStore, createSlice } from '@reduxjs/toolkit';

interface CounterState {
  value: number
}

const initialState = { value: 0 } satisfies CounterState as CounterState

export const counterSlice = createSlice({
    name: 'counter',
    initialState,
    reducers: {
        increment(state) {
            state.value++
        },
        decrement(state) {
            state.value--
        },
    }
});

export const store = configureStore({
    reducer: {
        counter: counterSlice.reducer
    }
});

export const { increment, decrement } = counterSlice.actions;
export const selectCounterValue = (state: {counter: CounterState}): number => state.counter.value;
