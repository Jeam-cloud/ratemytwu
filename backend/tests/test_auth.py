def test_create_review_authorized(client):
    response = client.post("/professor/1/review")
    assert response.status_code == 401

def test_delete_review_authorized(client):
    response = client.delete("/professor/review/1")
    assert response.status_code == 401