// importing dummy data:
import dummyData from '../db/dummyData.json' with {type: 'json'};

// this function is currently returning dummy data
export async function getProducts(req,res){
    // we prob want to instert an access token to our supabase db
    res.send(dummyData); // send it 
}