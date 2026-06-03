import { incrementVersion } from "../repositories/auth.repositories";


export async function forceLogout( userId:string ){

 await incrementVersion( userId );
}