"use client"

import { useState, useEffect } from "react"
import { useParams, useNavigate, useLocation } from "react-router-dom"
import { useSelector } from "react-redux"
import { Star, ArrowLeft, CheckCircle, SkipForward } from "lucide-react"
import { toast } from "sonner"

const RatingReviewPage = () => {
  const { skillListingID } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const user = useSelector((state) => state.auth.user)

  // Get session data from location state
  const sessionData = location.state?.sessionData
  const teacherID = location.state?.teacherID || sessionData?.teacherID?._id || sessionData?.teacherID
  const learnerID = location.state?.learnerID || sessionData?.learnerID?._id || sessionData?.learnerID || user?._id

  const [currentStep, setCurrentStep] = useState(1) // 1 = rating, 2 = review
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [reviewText, setReviewText] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submittedRating, setSubmittedRating] = useState(null)

  // Check authentication on mount
  useEffect(() => {
    if (!user) {
      toast.error("Please sign in to rate sessions")
      navigate("/signin", {
        state: {
          returnUrl: `/rating/${skillListingID}`,
          returnState: location.state,
        },
      })
      return
    }

    if (user.role !== "learner") {
      toast.error("Only learners can rate sessions")
      navigate("/sessions/learner")
      return
    }

    if (!skillListingID) {
      toast.error("Invalid skill listing")
      navigate("/sessions/learner")
      return
    }

    // Check if user has already rated this listing
    checkExistingRating()
  }, [user, skillListingID, navigate, location.state])

  const checkExistingRating = async () => {
    try {
      const response = await fetch(`http://localhost:3000/api/v1/ratings/listing/${skillListingID}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      })
      
      const data = await response.json()
      
      if (data.success && data.ratings && data.ratings.length > 0) {
        // Check if current user already has a rating
        const userRating = data.ratings.find(rating => 
          rating.learnerID._id === user._id || rating.learnerID === user._id
        )
        
        if (userRating) {
          // User already has a rating, show it and move to review step
          setSubmittedRating(userRating)
          setRating(userRating.rating)
          toast.info("You have already rated this listing. You can optionally add a review.")
          checkExistingReview() // Check if they have a review too
          return
        }
      }
    } catch (error) {
      console.error("Error checking existing rating:", error)
      // Continue normally if there's an error
    }
  }

  const getRatingText = (rating) => {
    const texts = {
      1: "Poor - Not satisfied",
      2: "Fair - Below expectations",
      3: "Good - Met expectations",
      4: "Very Good - Above expectations",
      5: "Excellent - Outstanding experience",
    }
    return texts[rating] || ""
  }

  const checkExistingReview = async () => {
    try {
      // Try to fetch existing reviews for this listing
      const response = await fetch(`http://localhost:3000/api/v1/reviews/listing/${skillListingID}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      })
      
      const data = await response.json()
      
      if (data.success && data.reviews) {
        // Check if current user already has a review
        const userReview = data.reviews.find(review => 
          review.learnerID._id === learnerID || review.learnerID === learnerID
        )
        
        if (userReview) {
          // User already has a review, show completion message with option to go back
          toast.success("Rating submitted! You have already reviewed this listing.")
          setCurrentStep(3) // Move to completion step
        } else {
          // No existing review, proceed to review step (optional)
          setCurrentStep(2)
        }
      } else {
        // Error fetching reviews, but proceed to review step anyway
        setCurrentStep(2)
      }
    } catch (error) {
      console.error("Error checking existing review:", error)
      // On error, proceed to review step
      setCurrentStep(2)
    }
  }

  const submitRating = async () => {
    if (rating === 0) {
      toast.error("Please select a rating")
      return
    }

    if (!teacherID || !learnerID) {
      toast.error("Missing required information")
      return
    }

    // If user already has a submitted rating, don't allow new submission
    if (submittedRating) {
      toast.info("You have already rated this listing. You can modify your review below.")
      setCurrentStep(2)
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch("http://localhost:3000/api/v1/ratings/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          learnerID: learnerID,
          teacherID: teacherID,
          listingID: skillListingID,
          rating: rating,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setSubmittedRating(data.rating)
        toast.success("Rating submitted successfully!")
        
        // Always proceed to review step after rating submission
        setCurrentStep(2)
      } else {
        // Handle specific error cases
        if (data.message && data.message.includes("already rated")) {
          toast.info("You have already rated this listing. Checking your existing rating...")
          // Refresh the existing rating
          checkExistingRating()
        } else {
          throw new Error(data.message || "Failed to submit rating")
        }
      }
    } catch (error) {
      console.error("Rating submission error:", error)
      if (error.message && error.message.includes("already rated")) {
        toast.info("You have already rated this listing. Checking your existing rating...")
        checkExistingRating()
      } else {
        toast.error(error.message || "Failed to submit rating")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const submitReview = async () => {
    if (reviewText.trim().length < 10) {
      toast.error("Review must be at least 10 characters long")
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch("http://localhost:3000/api/v1/reviews/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          learnerID: learnerID,
          teacherID: teacherID,
          listingID: skillListingID,
          reviewText: reviewText.trim(),
          rating: submittedRating?.rating || rating, // Keep the rating for the review
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success("Review submitted successfully!")
        navigate("/sessions/learner")
      } else {
        throw new Error(data.message || "Failed to submit review")
      }
    } catch (error) {
      console.error("Review submission error:", error)
      toast.error(error.message || "Failed to submit review")
    } finally {
      setIsSubmitting(false)
    }
  }

  const skipReview = () => {
    // Move to completion step without submitting a review
    setCurrentStep(3);
  };

  if (!user) {
    return null // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate("/sessions/learner")}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
          >
            <ArrowLeft size={20} />
            Back to Sessions
          </button>

          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              {currentStep === 1 ? "Rate Your Experience" : currentStep === 2 ? "Share Your Review (Optional)" : "Thank You!"}
            </h1>
            <p className="text-gray-600">
              {currentStep === 1 ? "How was your learning session?" : currentStep === 2 ? "Tell others about your experience" : "Your feedback has been submitted"}
            </p>
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center justify-center mt-6">
            <div className="flex items-center space-x-4">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  currentStep >= 1 ? "bg-yellow-500 text-white" : "bg-gray-200 text-gray-500"
                }`}
              >
                1
              </div>
              <div className={`w-16 h-1 ${currentStep >= 2 ? "bg-yellow-500" : "bg-gray-200"}`}></div>
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  currentStep >= 2 ? "bg-yellow-500 text-white" : "bg-gray-200 text-gray-500"
                }`}
              >
                2
              </div>
              <div className={`w-16 h-1 ${currentStep >= 3 ? "bg-yellow-500" : "bg-gray-200"}`}></div>
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  currentStep >= 3 ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"
                }`}
              >
                ✓
              </div>
            </div>
          </div>
        </div>

        {/* Session Info */}
        {sessionData && (
          <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
            <h3 className="font-semibold text-gray-800 mb-2">Session Details</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>
                <strong>Skill:</strong> {sessionData.skillName || sessionData.skillListingID?.title || "N/A"}
              </p>
              <p>
                <strong>Teacher:</strong> {sessionData.teacherID?.fullname || "N/A"}
              </p>
              <p>
                <strong>Date:</strong>{" "}
                {sessionData.scheduledTime ? new Date(sessionData.scheduledTime).toLocaleDateString() : "N/A"}
              </p>
            </div>
          </div>
        )}

        {/* Rating Step */}
        {currentStep === 1 && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="text-center mb-8">
              {submittedRating ? (
                <>
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">Your Rating</h2>
                  <div className="flex items-center gap-2 mb-4 justify-center">
                    <CheckCircle className="text-green-500" size={24} />
                    <span className="text-green-600 font-medium">You have already rated this listing</span>
                  </div>
                  
                  {/* Show existing rating */}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="text-gray-700 font-medium">Your Rating:</span>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            size={24}
                            className={`${
                              star <= submittedRating.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-gray-600">({submittedRating.rating}/5)</span>
                    </div>
                    <p className="text-gray-600">{getRatingText(submittedRating.rating)}</p>
                  </div>

                  <button
                    onClick={() => setCurrentStep(2)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
                  >
                    Continue to Review
                  </button>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">Rate Your Experience</h2>

                  {/* Star Rating */}
                  <div className="flex justify-center gap-2 mb-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoveredRating(star)}
                        onMouseLeave={() => setHoveredRating(0)}
                        className="transition-transform hover:scale-110"
                      >
                        <Star
                          size={40}
                          className={`${
                            star <= (hoveredRating || rating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
                          } transition-colors`}
                        />
                      </button>
                    ))}
                  </div>

                  {/* Rating Text */}
                  {(hoveredRating || rating) > 0 && (
                    <p className="text-lg text-gray-600 mb-6">{getRatingText(hoveredRating || rating)}</p>
                  )}

                  {/* Submit Button */}
                  <button
                    onClick={submitRating}
                    disabled={rating === 0 || isSubmitting}
                    className="bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-8 py-3 rounded-lg font-semibold transition-colors"
                  >
                    {isSubmitting ? "Submitting..." : "Submit Rating"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Review Step */}
        {currentStep === 2 && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="text-green-500" size={24} />
                <span className="text-green-600 font-medium">Rating Submitted!</span>
              </div>

              {submittedRating && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700">Your Rating:</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={20}
                          className={`${
                            star <= submittedRating.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-gray-600">({submittedRating.rating}/5)</span>
                  </div>
                </div>
              )}
            </div>

            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Write a Review (Optional)</h2>
            <p className="text-gray-600 mb-4">
              Would you like to share more details about your experience? This is completely optional.
            </p>

            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Share your experience with this teacher and skill. What did you learn? How was the teaching style? Would you recommend this to others?"
              className="w-full h-32 p-4 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              maxLength={500}
            />

            <div className="flex justify-between items-center mt-4">
              <span className="text-sm text-gray-500">
                {reviewText.length}/500 characters
                {reviewText.length > 0 && reviewText.length < 10 && (
                  <span className="text-red-500 ml-2">(Minimum 10 characters)</span>
                )}
              </span>
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={submitReview}
                disabled={reviewText.trim().length < 10 || isSubmitting}
                className="flex-1 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-lg font-semibold transition-colors"
              >
                {isSubmitting ? "Submitting..." : "Submit Review"}
              </button>

              <button
                onClick={skipReview}
                className="flex items-center gap-2 px-6 py-3 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg font-medium transition-colors"
              >
                <SkipForward size={18} />
                Skip Review
              </button>
            </div>
          </div>
        )}

        {/* Completion Step */}
        {currentStep === 3 && (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="text-green-600" size={32} />
              </div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-2">Thank You!</h2>
              <p className="text-gray-600">
                Your feedback has been submitted successfully. It helps improve the learning experience for everyone.
              </p>
            </div>

            {submittedRating && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-gray-700">Your Rating:</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={20}
                        className={`${
                          star <= submittedRating.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-gray-600">({submittedRating.rating}/5)</span>
                </div>
              </div>
            )}

            <button
              onClick={() => navigate("/sessions/learner")}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              Back to Sessions
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default RatingReviewPage
