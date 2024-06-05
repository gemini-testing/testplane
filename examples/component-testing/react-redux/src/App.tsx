import { useDispatch, useSelector } from 'react-redux';
import { increment, decrement, selectCounterValue } from './counter';

export default function App() {
    const dispatch = useDispatch();
    const value = useSelector(selectCounterValue);

    return (
        <div id="root">
            <p className="counter">Counter: {value}</p>
            <button id="inc" onClick={() => dispatch(increment())}>+</button>
            <button id="dec" onClick={() => dispatch(decrement())}>-</button>
        </div >
    );
}
