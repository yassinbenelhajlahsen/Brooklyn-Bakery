import {useEffect, useState, useCallback} from 'react'; 

export default function HomePage(){
    
    const [bakedGoods, setBakedGoods] = useState([]);

    /**
     * Use 'useCallback' instead
     */
    // async function loadBakedGoods(){
    //     console.log("called loadBakedGoods func");
    //     try{
    //         const response = await fetch("http://127.0.0.1:3000/HomePage");
    //         // console.log("response: ", response);
    //         const data = await response.json();
    //         // console.log("data: ", data);

    //         setBakedGoods(data.items);

    //     } catch (err) {
    //         console.error("error: ", err);
    //     }
    // }

    const loadBakedGoods = useCallback(async () => {
        console.log("called loadBakedGoods func");
        try{
            const response = await fetch("http://127.0.0.1:3000/products");
            // console.log("response: ", response);
            const data = await response.json();
            // console.log("data: ", data);

            setBakedGoods(data.items);

        } catch (err) {
            console.error("error: ", err);
        }
    }, [])

    useEffect(() => {
        console.log("HomePage is loading...");
        loadBakedGoods();
    }, [loadBakedGoods])

    
    // debug:
    useEffect(() => {
        console.log(bakedGoods);
    }, [bakedGoods])

    return (
        <div>
        {/* this should create product cards with relevant information on them */}
        {bakedGoods.map((item) => (
            // console.log(
            //     `
            //     -------------------------------------------------\n
            //     | id of product: ${item.id}\n
            //     | name of product: ${item.name}\n
            //     | price of product: ${item.price}\n
            //     | description of product: ${item.description}\n
            //     | type of product: ${item.type}\n
            //     -------------------------------------------------\n
            //     `
            // );

            <div key={item.id}>
                <img style={{width:'300px', height: '300px'}}
                    src={`bakedGoodsIMGs/${item.name}.jpg`}
                    alt={item.description}
                />
                <p>
                    <strong>{`${item.name}`}</strong>                   {/* bolded item name */}
                    <br />                                              {/* line break */}
                    Price: {`${item.price}`}                            {/* price of item */}
                </p>
            </div>
        ))}
        </div>
    )
}