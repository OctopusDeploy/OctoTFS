import { getOrDownloadOcto, resolvePublishedOctoVersion, addToolToPath, getEmbeddedOcto } from "../Utils/install";
import * as tasks from 'vsts-task-lib/task';

async function run(){
    let version = tasks.getInput("version");
    let forceEmbedded = /embedded/i.test(version);

    try{
        if(forceEmbedded){
            console.log("Forcing the use of embedded octo.");
            await getEmbeddedOcto(tasks.resolve(__dirname, "embedded")).then(addToolToPath);
        }else{
            let option = await resolvePublishedOctoVersion(tasks.getInput("version"));
            console.log(`Using octo version ${option.version}`);
            await getOrDownloadOcto(option).then(addToolToPath);

        }

        tasks.setResult(tasks.TaskResult.Succeeded, "");
    }catch(error){
        if(forceEmbedded){
            tasks.setResult(tasks.TaskResult.Failed, error);
            return;
        }

        console.log(`Failed to resolve latest octo version. Using embedded version. ${error}`);

        try {
            await getEmbeddedOcto(tasks.resolve(__dirname, "embedded")).then(addToolToPath);
        }catch(embeddedOctoError){
            tasks.setResult(tasks.TaskResult.Failed, embeddedOctoError);
        }
    }
}

run();