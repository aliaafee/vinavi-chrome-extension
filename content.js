chrome.runtime.onMessage.addListener(
    (request, sender, sendResponse) => {
        if (request.action === "getCases") {
            (async () => {
                const patientId = await getPatientId()
                if (patientId === null) {
                    sendResponse(null);
                    return true;
                }
                const cases = await getCases(patientId, request.page);
                sendResponse(cases);
            })();
            return true;
        }

        // if (request.action === "getEpisodes") {
        //     (async () => {
        //         const episodes = await getEpisodes(request.caseId);
        //         sendResponse(episodes);
        //     }) ();
        //     return true;
        // }

        if (request.action === "getEpisodeDetail") {
            (async () => {
                const episodeDetail = await getEpisodeDetail(request.episodeId);
                sendResponse(episodeDetail);
            })();
            return true;
        }
    }
);


async function getPatientId() {
    const currentUrl = window.location.href;

    const patientIdmatch = currentUrl.match(/\/patients\/(\d+)/);

    if (patientIdmatch) {
        return patientIdmatch[1];
    }

    return null;
}

function generateCasesUrl(patientId, page) {
    // return `https://vinavi.aasandha.mv/api/patients/${patientId}/patient-cases?include=last-episode,doctor&page%5Bnumber%5D=${page}&sort=-created_at`
    // return `https://vinavi.aasandha.mv/api/patients/${patientId}/patient-cases?include=last-episode,doctor&page%5Bnumber%5D=${page}&sort=-created_at&page%5Bsize%5D=2`
    return `https://vinavi.aasandha.mv/api/patients/${patientId}/patient-cases?include=episodes,doctor&page%5Bnumber%5D=${page}&sort=-created_at`
}

async function getCases(patientId, page) {
    try {
        const casesUrl = generateCasesUrl(patientId, page);

        const response = await fetch(casesUrl);
        if (!response.ok) {
            return null
        }

        return await response.json();
    } catch (error) {
        return null
    }

}

// function generateEpisodesUrl(caseId) {
//     return `https://vinavi.aasandha.mv/api/patient-cases/${caseId}/episodes?include=doctor,referral`
// }

// async function getEpisodes(caseId) {
//     const episodesUrl = generateEpisodesUrl(caseId);

//     const response = await fetch(episodesUrl);
//     if (!response.ok) {
//         return null
//     }

//     return await response.json();
// }

function generateEpisodeDetailUrl(episodeId) {
    return `https://vinavi.aasandha.mv/api/episodes/${episodeId}?include=patient,doctor,prescriptions.medicines.preferred-medicine,prescriptions.consumables.preferred-consumable,prescriptions.professional,requested-services.service.service-professions,requested-services.professional,requested-services.documents,diagnoses.icd-code,vitals,vitals.professional,admission,requested-admission,eev-referrals,current-eev-referral,notes.professional,diagnoses.professional`
}

async function getEpisodeDetail(episodeId) {
    try {
        const episodeUrl = generateEpisodeDetailUrl(episodeId);

        const response = await fetch(episodeUrl);
        if (!response.ok) {
            return null
        }

        return await response.json();
    } catch (error) {
        return null
    }
}