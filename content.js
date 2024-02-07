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

        if (request.action === "getEpisodeDetail") {
            (async () => {
                const episodeDetail = await getEpisodeDetail(request.episodeId);
                sendResponse(episodeDetail);
            })();
            return true;
        }

        if (request.action === "getPatient") {
            (async () => {
                const patientId = await getPatientId()
                if (patientId === null) {
                    sendResponse(null);
                    return true;
                }
                const patient = await getPatient(patientId);
                sendResponse(patient);
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

async function getResource(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            return null
        }

        return await response.json();
    } catch (error) {
        return null
    }
}

async function getCases(patientId, page) {
    return await getResource(
        `https://vinavi.aasandha.mv/api/patients/${patientId}/patient-cases?include=episodes,doctor&page%5Bnumber%5D=${page}&sort=-created_at`
    )
}

async function getEpisodeDetail(episodeId) {
    return await getResource(
        `https://vinavi.aasandha.mv/api/episodes/${episodeId}?include=patient,doctor,prescriptions.medicines.preferred-medicine,prescriptions.consumables.preferred-consumable,prescriptions.professional,requested-services.service.service-professions,requested-services.professional,requested-services.documents,diagnoses.icd-code,vitals,vitals.professional,admission,requested-admission,eev-referrals,current-eev-referral,notes.professional,diagnoses.professional`
    )
}

async function getPatient(patientId) {
    return await getResource(
        `https://vinavi.aasandha.mv/api/patients/${patientId}?include=current-admission,current-eev-referral,admission-request,address.island.atoll,blocked-patient`
    )
}

